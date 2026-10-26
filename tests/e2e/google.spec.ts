import { expect, test, type Page } from "@playwright/test";

import { createPasswordAccount, resetRateLimits, uniqueEmail } from "./helpers/accounts";

// Google sign-in against the local mock provider (E2E-02; tests/e2e/helpers/mock-google.ts).

const MOCK_AUTHORIZE = "http://localhost:3199/authorize**";

/** Makes the mock "Google" sign in as `email`, or answer like a press on Cancel. */
async function googleWill(page: Page, outcome: { signInAs: string } | "cancel") {
  await page.route(MOCK_AUTHORIZE, async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.has("login_hint") || url.searchParams.has("mock_error")) {
      await route.continue();
      return;
    }
    if (outcome === "cancel") url.searchParams.set("mock_error", "access_denied");
    else url.searchParams.set("login_hint", outcome.signInAs);
    await route.fulfill({ status: 302, headers: { location: url.toString() } });
  });
}

test.beforeEach(() => {
  resetRateLimits();
});

test("a new Google user confirms their age once, then goes to onboarding", async ({ page }) => {
  await googleWill(page, { signInAs: uniqueEmail() });
  await page.goto("/");

  await page.getByRole("button", { name: "Continue with Google" }).click();

  await expect(page).toHaveURL(/\/confirm-age\?returnTo=%2F$/);
  await page.getByLabel("Date of birth").fill("1995-08-15");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByRole("heading", { name: "What do you like making?" })).toBeVisible();
});

test("Google links to an existing password account with the same email", async ({ page }) => {
  const { email } = createPasswordAccount();
  await googleWill(page, { signInAs: email });
  await page.goto("/sign-in");

  await page.getByRole("button", { name: "Continue with Google" }).click();

  // The account already confirmed its age at registration, so it goes straight back.
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/sign-in");
  await expect(page.getByText("You're signed in.")).toBeVisible();
});

test("cancelling at Google returns to sign-in with a calm message", async ({ page }) => {
  await googleWill(page, "cancel");
  await page.goto("/sign-in");

  await page.getByRole("button", { name: "Continue with Google" }).click();

  await expect(page).toHaveURL(/\/sign-in\?error=OAuthCallbackError/);
  await expect(
    page.getByRole("alert").filter({ hasText: "Google sign-in was cancelled." }),
  ).toBeVisible();
});
