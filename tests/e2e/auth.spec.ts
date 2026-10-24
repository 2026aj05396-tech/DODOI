import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { createPasswordAccount } from "./helpers/accounts";

// Sign-in, sign-out and route protection (roadmap P1-04). Google sign-in needs a real Google
// account, so it is checked by hand on localhost:3000 instead.

test("a signed-out visit to a signed-in page goes to sign-in with a return path", async ({
  page,
}) => {
  await page.goto("/saved?sort=new");

  await expect(page).toHaveURL(/\/sign-in\?returnTo=%2Fsaved%3Fsort%3Dnew$/);
  await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
});

test("the sign-in page has no serious accessibility violations", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.getByLabel("Email")).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(blocking).toEqual([]);
});

test("a wrong password shows one message that does not reveal whether the email exists", async ({
  page,
}) => {
  const { email } = createPasswordAccount();
  await page.goto("/sign-in");

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("not the right password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "That email and password don't match. Check them and try again." }),
  ).toBeVisible();
});

test("an account without a password is told to continue with Google", async ({ page }) => {
  const { email } = createPasswordAccount({ noPassword: true });
  await page.goto("/sign-in");

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("any password at all");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(
    page.getByRole("alert").filter({ hasText: "Looks like you signed up with Google" }),
  ).toBeVisible();
});

test("signing in returns to the requested page, and signing out ends the session", async ({
  page,
}) => {
  const { email, password } = createPasswordAccount();
  await page.goto("/sign-in?returnTo=%2F%3Fwelcome%3D1");

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/\?welcome=1$/);

  await page.goto("/sign-in");
  await expect(page.getByText("You're signed in.")).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();

  await expect(page).toHaveURL(/\/$/);
  await page.goto("/saved");
  await expect(page).toHaveURL(/\/sign-in\?returnTo=%2Fsaved$/);
});

test("an unsafe returnTo is ignored", async ({ page }) => {
  const { email, password } = createPasswordAccount();
  await page.goto("/sign-in?returnTo=https%3A%2F%2Fevil.example%2F");

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/^http:\/\/localhost:3100\/$/);
});
