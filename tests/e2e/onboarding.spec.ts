import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { createPasswordAccount, resetRateLimits } from "./helpers/accounts";

// Onboarding (E2E-18, roadmap P1-11): continue disabled until 3 interests, no Skip on step 1,
// steps 2 and 3 skippable, progress saved and resumed.

async function signInToOnboarding(page: Page, options: { unverified?: boolean } = {}) {
  const { email, password } = createPasswordAccount({ onboardingIncomplete: true, ...options });
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  // Signing in returns to /, which sends unfinished accounts to onboarding.
  await expect(page).toHaveURL(/\/onboarding$/);
}

async function pick(page: Page, ...skills: string[]) {
  for (const skill of skills) {
    await page.getByRole("button", { name: skill, exact: true }).click();
  }
}

test.beforeEach(() => {
  resetRateLimits();
});

test("step 1 needs 3 interests and has no Skip", async ({ page }) => {
  await signInToOnboarding(page);
  await expect(page.getByRole("heading", { name: "What do you like making?" })).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter((v) => v.impact === "serious" || v.impact === "critical"),
  ).toEqual([]);

  await expect(page.getByRole("button", { name: "Pick 3 more to continue" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Skip" })).toHaveCount(0);
  await pick(page, "Crochet", "Knitting");
  await expect(page.getByRole("button", { name: "Pick 1 more to continue" })).toBeDisabled();
  await pick(page, "Embroidery");

  await expect(page.getByRole("button", { name: "Continue with 3 interests" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Crochet", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("search tolerates typos", async ({ page }) => {
  await signInToOnboarding(page);

  await page.getByRole("searchbox", { name: "Search interests" }).fill("crochte");

  await expect(page.getByRole("button", { name: "Crochet", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Knitting", exact: true })).toHaveCount(0);
});

test("levels and can-help are saved, and a reload resumes on the same step", async ({ page }) => {
  await signInToOnboarding(page);
  await pick(page, "Crochet", "Knitting", "Embroidery");
  await page.getByRole("button", { name: "Continue with 3 interests" }).click();

  await expect(
    page.getByRole("heading", { name: "How familiar are you with each?" }),
  ).toBeVisible();
  await page
    .getByRole("group", { name: "Your level in Crochet" })
    .getByRole("button", { name: "Beginner" })
    .click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Anything you could help others with?" }),
  ).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Anything you could help others with?" }),
  ).toBeVisible();

  await pick(page, "Knitting");
  await page.getByRole("button", { name: "Finish" }).click();
  await expect(page).toHaveURL(/\/feed$/);

  const saved = await page.evaluate(async () => (await fetch("/api/me/skills")).json());
  expect(saved).toMatchObject({
    items: expect.arrayContaining([
      expect.objectContaining({
        skill: expect.objectContaining({ name: "Crochet" }),
        level: "BEGINNER",
      }),
      expect.objectContaining({
        skill: expect.objectContaining({ name: "Knitting" }),
        canHelp: true,
      }),
    ]),
  });
  // Finished: onboarding no longer appears.
  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/feed$/);
});

test("app pages send an unfinished account to onboarding first", async ({ page }) => {
  await signInToOnboarding(page);

  await page.goto("/saved");

  await expect(page).toHaveURL(/\/onboarding\?returnTo=%2Fsaved$/);
});

test("adding your own interest asks unverified users to verify first", async ({ page }) => {
  await signInToOnboarding(page, { unverified: true });

  await page.getByRole("button", { name: "+ Add your own" }).click();

  await expect(
    page.getByRole("alert").filter({ hasText: "Verify your email to add your own interests." }),
  ).toBeVisible();
});

test("a verified user can add their own interest and it is selected", async ({ page }) => {
  await signInToOnboarding(page);
  const name = `Tiny clay ${Date.now() % 100000}`.replace(
    /\d/g,
    (digit) => "abcdefghij"[Number(digit)] ?? "",
  );

  await page.getByRole("button", { name: "+ Add your own" }).click();
  await page.getByLabel("Your own interest").fill(name);
  await page.getByRole("button", { name: "Add", exact: true }).click();

  await expect(page.getByRole("button", { name, exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});
