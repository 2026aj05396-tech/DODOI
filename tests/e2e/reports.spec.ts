import { randomUUID } from "node:crypto";

import { expect, test, type Browser, type Page } from "@playwright/test";

import { createPasswordAccount } from "./helpers/accounts";

// Reports (roadmap P1-28b; RPT-01…05): a maker reports a custom skill, an admin hides it, and it
// is gone for everyone; reporting a profile shows a neutral confirmation.

async function signIn(page: Page, options: { admin?: boolean } = {}) {
  const { email, password } = createPasswordAccount({ ...options, interests: ["crochet"] });
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(options.admin ? /\/admin\/posts$/ : /\/feed$/);
  await page.waitForLoadState();
}

async function newPage(browser: Browser, options: { admin?: boolean } = {}) {
  const page = await (await browser.newContext()).newPage();
  await signIn(page, options);
  return page;
}

async function report(page: Page, reason: string) {
  await page.getByRole("button", { name: "Report" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(reason).check();
  await dialog.getByLabel("Anything else? (optional)").fill("Please take a look.");
  await dialog.getByRole("button", { name: "Send report" }).click();
  await expect(dialog.getByRole("heading", { name: "Thanks for letting us know" })).toBeVisible();
  await dialog.getByRole("button", { name: "Done" }).click();
}

test("a reported custom skill can be hidden by an admin and is then gone", async ({
  page,
  browser,
}) => {
  await signIn(page);
  const name = `Odd craft ${randomUUID().slice(0, 6)}`;
  const created = await page.request.post("/api/skills", { data: { name } });
  const skill = (await created.json()) as { slug: string };

  await page.goto(`/s/${skill.slug}`);
  await report(page, "Offensive or hateful");

  const admin = await newPage(browser, { admin: true });
  await admin.getByRole("link", { name: "Reports" }).click();
  const card = admin.locator("main").getByRole("listitem").filter({ hasText: name });
  await expect(card).toContainText("1 report");
  await expect(card).toContainText("Please take a look.");
  await card.getByRole("button", { name: "Hide skill" }).click();
  await expect(admin.getByText(`${name} is hidden`).first()).toBeVisible();
  await expect(card).toHaveCount(0);

  const other = await newPage(browser);
  const response = await other.goto(`/s/${skill.slug}`);
  expect(response).not.toBeNull();
  await expect(other.getByRole("heading", { name: "We couldn't find that page" })).toBeVisible();

  await admin.getByRole("button", { name: "Resolved" }).click();
  const resolved = admin.locator("main").getByRole("listitem").filter({ hasText: name });
  await resolved.getByRole("button", { name: "Show again" }).click();
  await expect(admin.getByText(`${name} is visible again`).first()).toBeVisible();

  await admin.context().close();
  await other.context().close();
});

test("reporting a profile shows a neutral confirmation", async ({ page, browser }) => {
  const owner = await newPage(browser);
  await owner.goto("/profile");
  await expect(owner).toHaveURL(/\/u\/e2e-/);
  const profileUrl = owner.url();
  await owner.context().close();

  await signIn(page);
  await page.goto(profileUrl);
  await report(page, "Spam or advertising");
});
