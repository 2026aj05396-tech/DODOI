import { expect, test, type Page } from "@playwright/test";

import {
  createAIConversation,
  createPasswordAccount,
  createPost,
  resetRateLimits,
} from "./helpers/accounts";

// AI companion screens (roadmap P4-02; USER_FLOWS F-23). The companion is switched off for E2E runs
// (playwright.config.ts), so these cover everything around the answer: entry points, the
// test-version notice, saved chats (open, delete), the docked panel, and the "resting" state.
// Answers themselves are covered with a fake provider in the integration and component tests.

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/feed$/);
  await page.waitForLoadState();
}

const FREE_TIER_NOTICE =
  "Test version: Google may read your questions and photos. Don't share anything personal.";

test.beforeEach(() => {
  resetRateLimits();
});

test("E2E-30: Ask dodoi opens the companion with the test-version notice and a resting message", async ({
  page,
}) => {
  const { email, password } = createPasswordAccount();
  await signIn(page, email, password);

  await page.getByRole("link", { name: "Ask dodoi" }).click();
  await expect(page).toHaveURL(/\/companion$/);
  await expect(page.getByRole("heading", { name: "Companion", level: 1 })).toBeVisible();
  await expect(page.getByText("No chats yet")).toBeVisible();

  await page.getByRole("link", { name: "New chat" }).click();
  await expect(page).toHaveURL(/\/companion\/new$/);
  const chat = page.getByRole("region", { name: "dodoi companion" });
  await expect(chat.getByText(FREE_TIER_NOTICE)).toBeVisible();
  await expect(chat.getByText("The companion is resting. Try again later.")).toBeVisible();
  await expect(chat.getByLabel("Your question")).toBeDisabled();
});

test("E2E-30: a saved chat can be reopened, shows the AI label and skill links, and be deleted", async ({
  page,
}) => {
  const { email, password } = createPasswordAccount();
  const conversationId = createAIConversation(email);
  await signIn(page, email, password);

  await page.goto("/companion");
  await page.getByRole("link", { name: /How do I start crochet\?/ }).click();
  await expect(page).toHaveURL(new RegExp(`/companion/${conversationId}$`));
  const chat = page.getByRole("region", { name: "dodoi companion" });
  await expect(chat.getByText("AI", { exact: true })).toBeVisible();
  await expect(chat.getByText("Answers can be wrong.")).toBeVisible();
  await expect(chat.getByRole("link", { name: "Crochet" })).toHaveAttribute("href", "/s/crochet");
  await expect(chat.getByRole("button", { name: "Helpful", exact: true })).toBeVisible();
  await expect(chat.getByRole("button", { name: "Report" })).toBeVisible();

  await page.goto("/companion");
  await page.getByRole("button", { name: /Delete chat: How do I start crochet\?/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete chat" }).click();
  await expect(page.getByText("No chats yet")).toBeVisible();
  await page.goto(`/companion/${conversationId}`);
  await expect(page.getByRole("heading", { name: "We couldn't find that page" })).toBeVisible();
});

test("E2E-30: nobody else can open a saved chat", async ({ page }) => {
  const owner = createPasswordAccount();
  const other = createPasswordAccount();
  const conversationId = createAIConversation(owner.email);
  await signIn(page, other.email, other.password);

  await page.goto(`/companion/${conversationId}`);
  await expect(page.getByRole("heading", { name: "We couldn't find that page" })).toBeVisible();
});

test("E2E-30: a new chat about a post names it, and signed-out visitors are asked to sign in", async ({
  page,
}) => {
  const post = createPost();
  const { email, password } = createPasswordAccount();

  await page.goto(`/companion/new?post=${post.id}`);
  await expect(page).toHaveURL(/\/sign-in\?returnTo=/);

  await signIn(page, email, password);
  await page.goto(`/companion/new?post=${post.id}`);
  const chat = page.getByRole("region", { name: "dodoi companion" });
  await expect(chat.getByText(/Looking at: Granny square/)).toBeVisible();
});

test("E2E-30: from 1280px the companion docks beside a post and the sidebar becomes the icon rail", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "The docked panel is for desktop (1280px and up).");
  const post = createPost();
  const { email, password } = createPasswordAccount();
  await signIn(page, email, password);

  await page.goto(`/p/${post.id}`);
  const dock = page.getByRole("complementary", { name: "dodoi companion" });
  await expect(dock).toBeVisible();
  await expect(dock.getByText(/Talking about: Granny square/)).toBeVisible();
  await expect(dock.getByText(FREE_TIER_NOTICE)).toBeVisible();
  // The full sidebar (with its text labels) gives way to the 76px rail.
  await expect(page.getByRole("link", { name: "Journal" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Main" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Ask about this" })).toBeHidden();
});
