import { expect, test, type Page } from "@playwright/test";

import { createAIConversation, createPasswordAccount, resetRateLimits } from "./helpers/accounts";

// Settings → AI and privacy (roadmap P4-07, F-26): consent switches that stay as set, and deleting
// chats one by one or all at once. Works with the companion switched off (E2E runs).

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/feed$/);
  await page.waitForLoadState();
}

test.beforeEach(() => {
  resetRateLimits();
});

test("E2E-31: the AI switches are off until allowed, stay as set after a reload, and can be withdrawn", async ({
  page,
}) => {
  const { email, password } = createPasswordAccount();
  await signIn(page, email, password);

  await page.goto("/settings");
  await page.getByRole("link", { name: /AI and privacy/ }).click();
  await expect(page).toHaveURL(/\/settings\/ai$/);
  const photos = page.getByRole("switch", { name: /Use my photos in the companion/ });
  const interests = page.getByRole("switch", { name: /Use my interests and levels/ });
  await page.waitForLoadState("networkidle");
  await expect(photos).not.toBeChecked();
  await expect(interests).not.toBeChecked();
  await expect(page.getByText("Test version: Google may read your questions")).toBeVisible();

  const saved = page.waitForResponse(
    (response) => response.url().endsWith("/api/me/consents") && response.ok(),
  );
  await photos.check();
  await saved;
  await page.reload();
  await expect(photos).toBeChecked();
  await expect(interests).not.toBeChecked();

  const withdrawn = page.waitForResponse(
    (response) => response.url().endsWith("/api/me/consents") && response.ok(),
  );
  await photos.uncheck();
  await withdrawn;
  await page.reload();
  await expect(photos).not.toBeChecked();
});

test("E2E-31: chats can be deleted one at a time or all at once", async ({ page }) => {
  const { email, password } = createPasswordAccount();
  createAIConversation(email);
  createAIConversation(email);
  await signIn(page, email, password);

  await page.goto("/settings/ai");
  await page.waitForLoadState("networkidle");
  const deleteButtons = page.getByRole("button", { name: /Delete chat: How do I start crochet\?/ });
  await expect(deleteButtons).toHaveCount(2);

  await deleteButtons.first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete chat" }).click();
  await expect(deleteButtons).toHaveCount(1);

  await page.getByRole("button", { name: "Delete all conversations" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete all" }).click();
  await expect(page.getByText("No conversations")).toBeVisible();

  await page.goto("/companion");
  await expect(page.getByText("No chats yet")).toBeVisible();
});
