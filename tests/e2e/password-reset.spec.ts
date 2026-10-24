import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { createPasswordAccount, createResetToken, resetRateLimits } from "./helpers/accounts";

// Password reset end to end (E2E-03, roadmap P1-06). Emails are not sent in E2E runs, so the
// reset token is created directly.

async function expectNoSeriousA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(blocking).toEqual([]);
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);
}

test.beforeEach(() => {
  resetRateLimits();
});

test("Forgot password keeps the typed email and answers the same for any address", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("someone@example.test");
  await page.getByRole("link", { name: "Forgot password?" }).click();

  await expect(page).toHaveURL(/\/forgot-password$/);
  const email = page.getByLabel("Email").filter({ visible: true });
  await expect(email).toHaveValue("someone@example.test");
  await expectNoSeriousA11yViolations(page);
  await page.getByRole("button", { name: "Send reset link" }).click();

  await expect(page.getByText("If an account exists for this email")).toBeVisible();
});

test("a reset link sets a new password once and signs out existing sessions", async ({ page }) => {
  const { email, password } = createPasswordAccount();
  await signIn(page, email, password);
  const token = createResetToken(email);

  await page.goto(`/reset-password?token=${token}`);
  await expectNoSeriousA11yViolations(page);
  await page.getByLabel("New password", { exact: true }).fill("a fresh new password");
  await page.getByLabel("Confirm new password").fill("a fresh new password");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByText("Your password is set.")).toBeVisible();

  // The session from before the reset no longer works. (The proxy only checks that the cookie is
  // genuine; pages validate it against the database, which is what /sign-in shows here.)
  await page.goto("/sign-in");
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await expect(page.getByText("You're signed in.")).toHaveCount(0);
  await signIn(page, email, "a fresh new password");

  // The link was single-use.
  await page.goto(`/reset-password?token=${token}`);
  await page.getByLabel("New password", { exact: true }).fill("yet another password");
  await page.getByLabel("Confirm new password").fill("yet another password");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "This link has expired or was already used." }),
  ).toBeVisible();
});

test("mismatched new passwords are caught before sending", async ({ page }) => {
  await page.goto("/reset-password?token=anything");

  await page.getByLabel("New password", { exact: true }).fill("a fresh new password");
  await page.getByLabel("Confirm new password").fill("a different password");
  await page.getByRole("button", { name: "Save new password" }).click();

  await expect(page.getByText("The passwords don't match.")).toBeVisible();
});
