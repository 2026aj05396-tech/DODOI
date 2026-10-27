import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import {
  createPasswordAccount,
  createVerificationToken,
  resetRateLimits,
  uniqueEmail,
} from "./helpers/accounts";

// Registration, email verification and the date-of-birth step (roadmap P1-05). Emails are not
// sent in E2E runs, so verification tokens are created directly.

async function expectNoSeriousA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(blocking).toEqual([]);
}

/** Signs in; `/` then sends an account without a confirmed age straight to the age step. */
async function signIn(page: Page, email: string, password: string, landing = /\/$/) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(landing);
}

test.beforeEach(() => {
  // Each Playwright project registers several accounts from the same IP (limit 5 per hour).
  resetRateLimits();
});

test("signing up creates an account, signs in and asks to check email", async ({ page }) => {
  await page.goto("/sign-up");
  await expectNoSeriousA11yViolations(page);

  await page.getByLabel("Email").fill(uniqueEmail());
  await page.getByLabel("Password").fill("a long enough password");
  await page.getByLabel("Date of birth").fill("1998-04-17");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await page.getByRole("button", { name: "Resend email" }).click();
  await expect(page.getByText("We've sent a new link.")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.goto("/sign-in");
  await expect(page.getByText("You're signed in.")).toBeVisible();
});

test("signing up with a registered email says so on the email field", async ({ page }) => {
  const { email } = createPasswordAccount();
  await page.goto("/sign-up");

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("a long enough password");
  await page.getByLabel("Date of birth").fill("1998-04-17");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByText("This email is already registered.")).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveAttribute("aria-invalid", "true");

  // "Sign in instead" carries the email over (not in the URL) and moves to the password.
  await page.getByRole("link", { name: "Sign in instead" }).click();
  await expect(page).toHaveURL(/\/sign-in\?returnTo=%2F$/);
  // Next.js keeps the sign-up page mounted but hidden after navigating, so match visible fields.
  await expect(page.getByLabel("Email").filter({ visible: true })).toHaveValue(email);
  await expect(page.getByLabel("Password").filter({ visible: true })).toBeFocused();
});

test("signing up with an email that uses Google offers Continue with Google", async ({ page }) => {
  const { email } = createPasswordAccount({ noPassword: true });
  await page.goto("/sign-up");

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("a long enough password");
  await page.getByLabel("Date of birth").fill("1998-04-17");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByText("Looks like you signed up with Google.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
});

test("E2E-01 (until the feed exists): sign up, verify, onboard", async ({ page }) => {
  const email = uniqueEmail();
  await page.goto("/");
  await page.getByRole("link", { name: "Sign up with email" }).click();

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("a long enough password");
  await page.getByLabel("Date of birth").fill("1998-04-17");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

  await page.goto(`/verify-email?token=${createVerificationToken(email)}`);
  await page.getByRole("button", { name: "Confirm my email" }).click();
  await expect(page.getByText("Your email is confirmed.")).toBeVisible();
  await page.getByRole("link", { name: "Continue" }).click();

  await expect(page).toHaveURL(/\/onboarding$/);
  for (const skill of ["Crochet", "Embroidery", "Knitting"]) {
    await page.getByRole("button", { name: skill, exact: true }).click();
  }
  await page.getByRole("button", { name: "Continue with 3 interests" }).click();
  await page.getByRole("button", { name: "Skip" }).click();
  await page.getByRole("button", { name: "Skip" }).click();
  // The personalised feed (P1-22) will be the destination; until then onboarding returns to /.
  await expect(page).toHaveURL(/\/feed$/);
});

test("sign-up refuses under-18s with the agreed message", async ({ page }) => {
  await page.goto("/sign-up");

  await page.getByLabel("Email").fill(uniqueEmail());
  await page.getByLabel("Password").fill("a long enough password");
  await page.getByLabel("Date of birth").fill("2015-06-01");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(
    page.getByRole("alert").filter({
      hasText: "dodoi is for adults 18 and over, so we can't create an account for you.",
    }),
  ).toBeVisible();
});

test("a verification link confirms the email once", async ({ page }) => {
  const { email } = createPasswordAccount({ unverified: true });
  const token = createVerificationToken(email);

  await page.goto(`/verify-email?token=${token}`);
  await expectNoSeriousA11yViolations(page);
  await page.getByRole("button", { name: "Confirm my email" }).click();
  await expect(page.getByText("Your email is confirmed.")).toBeVisible();

  await page.goto(`/verify-email?token=${token}`);
  await page.getByRole("button", { name: "Confirm my email" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "This link has expired or was already used." }),
  ).toBeVisible();
});

test("a signed-in user without a confirmed age is sent to the date-of-birth step first", async ({
  page,
}) => {
  const { email, password } = createPasswordAccount({ ageUnconfirmed: true });
  await signIn(page, email, password, /\/confirm-age$/);

  await page.goto("/saved");
  await expect(page).toHaveURL(/\/confirm-age\?returnTo=%2Fsaved$/);
  await expectNoSeriousA11yViolations(page);

  await page.getByLabel("Date of birth").fill("1990-01-01");
  await page.getByRole("button", { name: "Continue" }).click();

  // /saved is built later (P1-17): reaching it at all shows the age gate let the user through.
  await expect(page).toHaveURL(/\/saved$/);
});

test("an under-18 at the date-of-birth step is signed out and the account removed", async ({
  page,
}) => {
  const { email, password } = createPasswordAccount({ ageUnconfirmed: true });
  await signIn(page, email, password, /\/confirm-age$/);

  await page.goto("/confirm-age");
  await page.getByLabel("Date of birth").fill("2012-03-03");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("alert").filter({ hasText: "dodoi is for adults 18" })).toBeVisible();
  await page.goto("/saved");
  await expect(page).toHaveURL(/\/sign-in\?returnTo=%2Fsaved$/);
});
