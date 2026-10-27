import { expect, test, type Page } from "@playwright/test";

import { createPasswordAccount, resetRateLimits } from "./helpers/accounts";

// Account deletion (F-14, AUTH-08, roadmap P1-28): deactivate from settings, see the scheduled
// screen on the next sign-in, cancel within the grace period.

const MOCK_AUTHORIZE = "http://localhost:3199/authorize**";

async function signInWithPassword(page: Page, email: string, password: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test.beforeEach(() => {
  resetRateLimits();
});

test("delete with a password, sign in again, cancel the deletion", async ({ page }) => {
  const { email, password } = createPasswordAccount({
    interests: ["crochet", "knitting", "sewing"],
  });
  await signInWithPassword(page, email, password);
  await expect(page).toHaveURL(/\/feed$/);

  await page.goto("/settings/account");
  await page.getByRole("link", { name: "Delete account" }).click();
  await expect(page).toHaveURL(/\/settings\/account\/delete$/);
  await expect(page.getByRole("heading", { name: "What happens" })).toBeVisible();

  await page.getByLabel("Your password").fill("not my password at all");
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page.getByText("That isn't your password.")).toBeVisible();

  await page.getByLabel("Your password").fill(password);
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Your account is scheduled for deletion" }),
  ).toBeVisible();

  // Signed out everywhere.
  await page.goto("/feed");
  await expect(page).toHaveURL(/\/sign-in/);

  await signInWithPassword(page, email, password);
  await expect(page).toHaveURL(/\/account-deletion$/);
  await expect(
    page.getByRole("heading", { name: "Your account is scheduled for deletion" }),
  ).toBeVisible();
  await page.goto("/saved");
  await expect(page).toHaveURL(/\/account-deletion$/);

  await page.getByRole("button", { name: "Cancel deletion" }).click();
  await expect(page).toHaveURL(/\/feed$/);
  await page.goto("/settings/account");
  await expect(page.getByRole("heading", { name: "Account", level: 1 })).toBeVisible();
});

test("a Google-only account that just signed in confirms without a password", async ({ page }) => {
  const { email } = createPasswordAccount({
    noPassword: true,
    interests: ["crochet", "knitting", "sewing"],
  });
  await page.route(MOCK_AUTHORIZE, async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.has("login_hint")) {
      await route.continue();
      return;
    }
    url.searchParams.set("login_hint", email);
    await route.fulfill({ status: 302, headers: { location: url.toString() } });
  });
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(page).toHaveURL(/\/feed$/);

  await page.goto("/settings/account/delete");
  await expect(page.getByLabel("Your password")).toHaveCount(0);
  await page.getByRole("button", { name: "Delete my account" }).click();

  await expect(
    page.getByRole("status").filter({ hasText: "Your account is scheduled for deletion" }),
  ).toBeVisible();
});
