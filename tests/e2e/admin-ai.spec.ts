import { expect, test, type Page } from "@playwright/test";

import { createPasswordAccount, resetRateLimits } from "./helpers/accounts";

// Admin → AI (roadmap P4-05, AIC-10): the kill switch, the usage page, and who can open it.
// The companion is off for E2E runs, so the switch is shown as "not set up" and can't be flipped
// here; the switch itself is covered by the integration and component tests.

async function signIn(page: Page, email: string, password: string, landing: RegExp) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(landing);
  await page.waitForLoadState();
}

test.beforeEach(() => {
  resetRateLimits();
});

test("E2E-32: an admin sees the AI usage page with the cap, totals and 30 days", async ({
  page,
}) => {
  const admin = createPasswordAccount({ admin: true });
  await signIn(page, admin.email, admin.password, /\/admin/);

  await page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "AI" }).click();
  await expect(page).toHaveURL(/\/admin\/ai$/);
  await expect(page.getByRole("heading", { name: "AI companion", level: 1 })).toBeVisible();
  await expect(page.getByText(/0 of 500 requests used/)).toBeVisible();
  await expect(page.getByText(/AI_ENABLED, the key or the model is not set/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Switch off" })).toBeDisabled();
  await expect(page.getByRole("table").getByRole("row")).toHaveCount(31);

  await page.getByRole("button", { name: "7 days" }).click();
  await expect(page.getByRole("table").getByRole("row")).toHaveCount(8);
});

test("E2E-32: members and moderators get the not-found page for the AI admin page and API", async ({
  page,
}) => {
  const member = createPasswordAccount();
  await signIn(page, member.email, member.password, /\/feed$/);
  await page.goto("/admin/ai");
  await expect(page.getByRole("heading", { name: "We couldn't find that page" })).toBeVisible();
  const usage = await page.request.get("/api/admin/ai/usage");
  expect(usage.status()).toBe(404);
  const toggle = await page.request.put("/api/admin/ai/switch", { data: { enabled: false } });
  expect(toggle.status()).toBe(404);

  await page.context().clearCookies();
  const moderator = createPasswordAccount({ moderator: true });
  await signIn(page, moderator.email, moderator.password, /\/admin\/reports|\/feed/);
  await page.goto("/admin/ai");
  await expect(page.getByRole("heading", { name: "We couldn't find that page" })).toBeVisible();
});
