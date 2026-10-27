import { expect, test, type Page } from "@playwright/test";

import { createPasswordAccount, resetRateLimits } from "./helpers/accounts";

// The verify-email banner (OD-08) and returning after an expired session (E2E-14).

async function signIn(page: Page, email: string, password: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test.beforeEach(() => {
  resetRateLimits();
});

test("an unverified user sees the verify banner on app pages and can resend", async ({ page }) => {
  const { email, password } = createPasswordAccount({ unverified: true });
  await page.goto("/sign-in");
  await signIn(page, email, password);
  await expect(page).toHaveURL(/\/feed$/);

  // /shell-preview is the local preview of the signed-in shell (no app pages exist yet).
  await page.goto("/shell-preview");
  const banner = page.getByRole("complementary", { name: "Verify your email" });
  await expect(banner).toBeVisible();
  await banner.getByRole("button", { name: "Resend email" }).click();
  await expect(banner.getByText("We've sent a new link.")).toBeVisible();
});

test("a verified user sees no verify banner", async ({ page }) => {
  const { email, password } = createPasswordAccount();
  await page.goto("/sign-in");
  await signIn(page, email, password);
  await expect(page).toHaveURL(/\/feed$/);

  await page.goto("/shell-preview");
  await expect(page.getByRole("navigation", { name: "Main" }).first()).toBeAttached();
  await expect(page.getByRole("complementary", { name: "Verify your email" })).toHaveCount(0);
});

test("an expired session goes to sign-in and comes back to the page afterwards", async ({
  page,
  context,
}) => {
  const { email, password } = createPasswordAccount();
  // A session cookie that is no longer valid (e.g. expired or from an old secret).
  await context.addCookies([
    { name: "authjs.session-token", value: "expired-session", url: "http://localhost:3100" },
  ]);

  await page.goto("/explore?tab=new");
  await expect(page).toHaveURL(/\/sign-in\?returnTo=%2Fexplore%3Ftab%3Dnew$/);
  await signIn(page, email, password);

  await expect(page).toHaveURL(/\/explore\?tab=new$/);
});
