import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { createFeedPosts, createPasswordAccount } from "./helpers/accounts";

// Home feed (roadmap P1-22; E2E-06, E2E-15 without the skill-page step, which arrives with P1-26).
// The E2E database keeps every test's posts, so each test makes its own skill and posts and filters
// to it where it needs exact results. Media URLs point at the fake "e2e-cloud" account.

async function signInWithInterests(page: Page, interests: string[]) {
  const { email, password } = createPasswordAccount({ interests });
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/feed$/);
}

/** The response to a "Not interested" (POST) or its undo (DELETE). */
function feedbackResponse(page: Page, method: "POST" | "DELETE") {
  return page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/feed/feedback") &&
      response.request().method() === method &&
      response.status() === 204,
  );
}

const feed = (page: Page) => page.getByRole("region", { name: "Your feed" });
const cardLinks = (page: Page) => feed(page).locator('a[href^="/p/"]');

test("E2E-06: pages load without repeats until the end of the feed", async ({ page }) => {
  const craft = createFeedPosts(30);
  await signInWithInterests(page, [craft.skillSlug]);

  await page.getByRole("button", { name: craft.skillName }).click();
  // Newest first: the last post created is on the first page of the chip's session.
  await expect(feed(page).locator(`a[href="/p/${craft.ids.at(-1)}"]`)).toBeVisible();
  await expect(cardLinks(page)).toHaveCount(20);

  // The next page loads on scroll ("Load more" is the keyboard fallback, tested below).
  const nextPage = page.waitForResponse(
    (response) => response.url().includes("/api/feed?") && response.url().includes("cursor="),
  );
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await nextPage;

  await expect(cardLinks(page)).toHaveCount(30);
  await expect(page.getByText("You're all caught up", { exact: false })).toBeVisible();
  const hrefs = await cardLinks(page).evaluateAll((links) =>
    links.map((link) => link.getAttribute("href")),
  );
  expect(new Set(hrefs).size).toBe(30);
});

test("E2E-06: Not interested hides a post, Undo brings it back, and it stays hidden", async ({
  page,
}) => {
  const craft = createFeedPosts(3);
  await signInWithInterests(page, [craft.skillSlug]);
  await page.getByRole("button", { name: craft.skillName }).click();
  const title = `Feed post ${craft.skillSlug.replace("feed-craft-", "")} 0`;
  await expect(feed(page).getByRole("heading", { name: title })).toBeVisible();

  await page.getByRole("button", { name: `More options for ${title}` }).click();
  await page.getByRole("menuitem", { name: "Not interested" }).click();
  await expect(feed(page).getByText("Hidden.")).toBeVisible();
  const undone = feedbackResponse(page, "DELETE");
  await feed(page).getByRole("button", { name: "Undo" }).click();
  await undone;
  await expect(feed(page).getByRole("heading", { name: title })).toBeVisible();

  const hidden = feedbackResponse(page, "POST");
  await page.getByRole("button", { name: `More options for ${title}` }).click();
  await page.getByRole("menuitem", { name: "Not interested" }).click();
  await hidden;

  await page.reload();
  await page.getByRole("button", { name: craft.skillName }).click();
  await expect(cardLinks(page)).toHaveCount(2);
  await expect(feed(page).getByRole("heading", { name: title })).toHaveCount(0);
});

test("E2E-15: an interest chip shows only that skill; New to you only other skills", async ({
  page,
}) => {
  const mine = createFeedPosts(2);
  const other = createFeedPosts(2);
  await signInWithInterests(page, [mine.skillSlug]);

  await page.getByRole("button", { name: mine.skillName }).click();
  await expect(page.getByRole("button", { name: mine.skillName })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(cardLinks(page)).toHaveCount(2);
  for (const id of mine.ids) {
    await expect(feed(page).locator(`a[href="/p/${id}"]`)).toBeVisible();
  }

  await page.getByRole("button", { name: "New to you" }).click();
  await expect(cardLinks(page).first()).toBeVisible();
  for (const id of mine.ids) {
    await expect(feed(page).locator(`a[href="/p/${id}"]`)).toHaveCount(0);
  }
  // `other` is outside the interests, so it may appear; nothing from `mine` may.
  expect(other.ids).toHaveLength(2);
});

test("saving from a card sticks after a reload", async ({ page }) => {
  const craft = createFeedPosts(1);
  await signInWithInterests(page, [craft.skillSlug]);
  await page.getByRole("button", { name: craft.skillName }).click();
  const title = `Feed post ${craft.skillSlug.replace("feed-craft-", "")} 0`;
  const save = page.getByRole("button", { name: `Save ${title}` });

  const saved = page.waitForResponse(
    (response) => response.url().includes("/api/saves/") && response.ok(),
  );
  await save.click();
  await saved;
  await expect(save).toHaveAttribute("aria-pressed", "true");

  await page.reload();
  await page.getByRole("button", { name: craft.skillName }).click();
  await expect(page.getByRole("button", { name: `Save ${title}` })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("the New to you card is in the feed on mobile and in the right rail on desktop", async ({
  page,
  isMobile,
}) => {
  const craft = createFeedPosts(2);
  // Interested in something else, so this craft's pitched skill can be suggested.
  const elsewhere = createFeedPosts(1);
  await signInWithInterests(page, [elsewhere.skillSlug]);
  expect(craft.ids).toHaveLength(2);

  const suggestion = page.getByText("New to you", { exact: true }).filter({ visible: true });
  if (isMobile) {
    await expect(feed(page).getByText("New to you", { exact: true })).toBeVisible();
  } else {
    await expect(
      page.getByRole("complementary", { name: "Suggestions" }).getByText("New to you", {
        exact: true,
      }),
    ).toBeVisible();
  }
  await expect(suggestion.first()).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(blocking).toEqual([]);
});

test("Load more fetches the next page for keyboard users", async ({ page }) => {
  const craft = createFeedPosts(25);
  await signInWithInterests(page, [craft.skillSlug]);
  await page.getByRole("button", { name: craft.skillName }).click();
  await expect(feed(page).locator(`a[href="/p/${craft.ids.at(-1)}"]`)).toBeVisible();

  const loadMore = page.getByRole("button", { name: "Load more" });
  await loadMore.focus();
  await page.keyboard.press("Enter");

  await expect(cardLinks(page)).toHaveCount(25);
});
