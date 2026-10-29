import { expect, test, type Page } from "@playwright/test";

import { createPasswordAccount, createPost, resetRateLimits } from "./helpers/accounts";

// Safety (roadmap P2-08, E2E-25; USER_FLOWS F-22): block someone from their profile and unblock
// from Settings; report a post, and a moderator hides it from the reports queue.

async function signIn(page: Page, email: string, password: string, landing: RegExp = /\/feed$/) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(landing);
  await page.waitForLoadState();
}

const INTERESTS = ["crochet", "knitting", "sewing"];
const NOT_FOUND = "We couldn't find that page";

test.beforeEach(() => {
  resetRateLimits();
});

test("E2E-25: block a maker from their profile, their post disappears, unblock from Settings", async ({
  page,
}) => {
  const post = createPost({ creator: true });
  const { creatorUsername, creatorName } = post;
  if (!creatorUsername || !creatorName) throw new Error("No creator");
  const { email, password } = createPasswordAccount({ interests: INTERESTS });
  await signIn(page, email, password);

  await page.goto(`/u/${creatorUsername}`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Block" }).click();
  await expect(page.getByRole("dialog").getByText(`Block @${creatorUsername}?`)).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Block", exact: true }).click();
  // Back to the page before (a fresh page load here, so the toast is not checked).
  await expect(page).toHaveURL(/\/feed$/);

  // Their profile and post are gone for you.
  await page.goto(`/u/${creatorUsername}`);
  await expect(page.getByRole("heading", { name: NOT_FOUND })).toBeVisible();
  await page.goto(`/p/${post.id}`);
  await expect(page.getByRole("heading", { name: NOT_FOUND })).toBeVisible();

  await page.goto("/settings/blocked");
  await expect(page.getByText(`@${creatorUsername}`)).toBeVisible();
  await page.getByRole("button", { name: `Unblock ${creatorName}` }).click();
  await expect(page.getByText("You haven't blocked anyone")).toBeVisible();

  await page.goto(`/p/${post.id}`);
  await expect(page.getByRole("heading", { level: 1 }).first()).toContainText("Granny square");
});

test("a report reaches the moderator, who hides the post for everyone else", async ({
  browser,
  page,
}) => {
  // Two sign-ins, a report and a moderator action.
  test.setTimeout(60_000);
  const post = createPost({ creator: true });
  const reporter = createPasswordAccount({ interests: INTERESTS });
  const moderator = createPasswordAccount({ moderator: true });
  await signIn(page, reporter.email, reporter.password);
  await page.goto(`/p/${post.id}`);
  await page.waitForLoadState("networkidle");

  await page.getByRole("button", { name: "More options for this post" }).click();
  await page.getByRole("menuitem", { name: "Report post" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Not my work").check();
  await dialog.getByRole("button", { name: "Send report" }).click();
  await expect(dialog.getByText("Thanks for letting us know")).toBeVisible();

  const modPage = await browser.newPage();
  await signIn(modPage, moderator.email, moderator.password);
  await modPage.goto("/admin/reports");
  // Moderators see the reports queue only.
  await expect(modPage.getByRole("link", { name: "Reports" })).toBeVisible();
  await expect(modPage.getByRole("link", { name: "Posts" })).toHaveCount(0);
  // Other tests report posts too: work only on this post's card.
  const card = modPage.getByRole("listitem").filter({
    has: modPage.locator(`a[href="/p/${post.id}"]`),
  });
  await expect(card.getByText("Not my work")).toBeVisible();
  await card.getByRole("button", { name: /^Hide/ }).click();
  // Actioned reports leave the Open tab.
  await expect(card).toHaveCount(0);
  await modPage.goto("/admin/posts");
  await expect(modPage.getByRole("heading", { name: NOT_FOUND })).toBeVisible();
  await modPage.close();

  await page.goto(`/p/${post.id}`);
  await expect(page.getByRole("heading", { name: NOT_FOUND })).toBeVisible();
});
