import { expect, test, type Browser, type Page } from "@playwright/test";

import { createPasswordAccount, resetRateLimits } from "./helpers/accounts";

// Help requests (roadmap P3-03, E2E-33; USER_FLOWS F-27): ask → a matching maker answers → the
// asker marks it helpful and resolved; reporting and blocking.

async function signIn(page: Page, email: string, password: string, landing: RegExp = /\/feed$/) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(landing);
  await page.waitForLoadState();
}

async function newPage(browser: Browser, baseURL: string | undefined): Promise<Page> {
  const context = await browser.newContext({ baseURL });
  return context.newPage();
}

test.beforeEach(() => {
  resetRateLimits();
});

test("E2E-33: ask for help, a matching maker answers, the asker marks it helpful and resolved", async ({
  browser,
  page,
  baseURL,
}) => {
  test.setTimeout(120_000);
  const asker = createPasswordAccount({ interests: ["watercolor"] });
  const helper = createPasswordAccount({ interests: ["crochet"], canHelp: ["watercolor"] });
  const title = `Blotchy sky ${Date.now()}`;

  // Asha asks.
  await signIn(page, asker.email, asker.password);
  await page.goto("/community");
  await page.waitForLoadState("networkidle");
  await page.getByRole("link", { name: "Ask for help" }).first().click();
  await expect(page).toHaveURL(/\/community\/help\/new$/);
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Craft").selectOption({ label: "Watercolor" });
  await page.getByLabel("What do you need help with?").fill("My wash dries in patches.");
  await page.getByRole("button", { name: "Post request" }).click();
  await expect(page).toHaveURL(/\/community\/help\/(?!new$)[^/]+$/);
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(page.locator("main header").getByText("Open", { exact: true })).toBeVisible();
  const requestUrl = page.url();
  // Nobody can answer their own request.
  await expect(page.getByLabel("Offer help")).toHaveCount(0);

  // A maker who can help with watercolor sees it and answers.
  const helperPage = await newPage(browser, baseURL);
  await signIn(helperPage, helper.email, helper.password);
  await helperPage.goto("/community");
  await helperPage.waitForLoadState("networkidle");
  await expect(helperPage.getByText("You can help with: Watercolor")).toBeVisible();
  await expect(helperPage.getByText(/\d+ open requests? match(es)? your skills/)).toBeVisible();
  await helperPage.getByRole("link", { name: title }).click();
  await helperPage.waitForLoadState("networkidle");
  await helperPage.getByLabel("Offer help").fill("Wet the paper evenly first.");
  await helperPage.getByRole("button", { name: "Send" }).click();
  await expect(helperPage.getByText("Wet the paper evenly first.")).toBeVisible();

  // Asha is told, marks the reply helpful and resolves the request.
  await page.goto("/notifications");
  await expect(page.getByText(/offered help on/)).toBeVisible();
  await page.goto(requestUrl);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "This helped" }).click();
  await expect(page.getByRole("button", { name: "Marked helpful" })).toBeVisible();
  await page.getByRole("button", { name: "Mark as resolved" }).click();
  await expect(page.getByRole("button", { name: "Reopen" })).toBeVisible();

  // The helper sees the thanks and that it is closed.
  await helperPage.goto(requestUrl);
  await expect(helperPage.getByText("This request is resolved.")).toBeVisible();
  await helperPage.goto("/notifications");
  await expect(helperPage.getByText(/found your help useful/)).toBeVisible();
  await expect(helperPage.getByText(/marked .* as resolved/)).toBeVisible();

  // It left the Open list and is under Resolved.
  await page.goto("/community");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("link", { name: title })).toHaveCount(0);
  await page.getByRole("button", { name: "Resolved" }).click();
  await expect(page.getByRole("link", { name: title })).toBeVisible();
});

test("E2E-33: a reported request reaches a moderator, who hides it for everyone but the asker", async ({
  browser,
  page,
  baseURL,
}) => {
  test.setTimeout(120_000);
  const asker = createPasswordAccount({ interests: ["watercolor"] });
  const reader = createPasswordAccount({ interests: ["crochet"] });
  const moderator = createPasswordAccount({ moderator: true });
  const title = `Spammy question ${Date.now()}`;

  await signIn(page, asker.email, asker.password);
  await page.goto("/community/help/new");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Craft").selectOption({ label: "Watercolor" });
  await page.getByLabel("What do you need help with?").fill("Buy my course.");
  await page.getByRole("button", { name: "Post request" }).click();
  await expect(page).toHaveURL(/\/community\/help\/(?!new$)[^/]+$/);
  const requestUrl = page.url();

  const readerPage = await newPage(browser, baseURL);
  await signIn(readerPage, reader.email, reader.password);
  await readerPage.goto(requestUrl);
  await readerPage.waitForLoadState("networkidle");
  await readerPage.getByRole("button", { name: "More options for this request" }).click();
  await readerPage.getByRole("menuitem", { name: "Report request" }).click();
  await readerPage.getByRole("dialog").getByText("Spam or advertising").click();
  await readerPage.getByRole("button", { name: "Send report" }).click();
  await expect(readerPage.getByText("Thanks for letting us know")).toBeVisible();

  const modPage = await newPage(browser, baseURL);
  await signIn(modPage, moderator.email, moderator.password, /\/admin\/reports|\/feed/);
  await modPage.goto("/admin/reports");
  const row = modPage.getByRole("listitem").filter({ hasText: title });
  await expect(row.getByText("Help request").first()).toBeVisible();
  await row.getByRole("button", { name: "Hide help request" }).click();
  await expect(row).toHaveCount(0);

  await readerPage.goto(requestUrl);
  await expect(
    readerPage.getByRole("heading", { name: "We couldn't find that page" }),
  ).toBeVisible();
  // The asker still sees it, with a notice.
  await page.goto(requestUrl);
  await expect(page.getByText("Hidden after a report.")).toBeVisible();
});
