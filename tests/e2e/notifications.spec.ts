import { expect, test } from "@playwright/test";

import { createNotifications, createPasswordAccount, resetRateLimits } from "./helpers/accounts";

// Notifications (roadmap P2-07, E2E-24; USER_FLOWS F-21): the bell's dot, the list, marking read,
// opening a comment, and the settings switches. Who gets which notification is covered in
// `notifications.test.ts`; here the notifications are seeded.

test.beforeEach(() => {
  resetRateLimits();
});

test("E2E-24: the bell shows a dot, the list explains each item and clears the dot", async ({
  page,
}) => {
  const { email, password } = createPasswordAccount({
    interests: ["crochet", "knitting", "sewing"],
  });
  const title = createNotifications(email);
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/feed$/);
  await page.waitForLoadState("networkidle");

  const bell = page.getByRole("link", { name: "Notifications, new" }).filter({ visible: true });
  await expect(bell).toBeVisible();
  await bell.click();
  await expect(page).toHaveURL(/\/notifications$/);

  await expect(page.getByText(`Asha commented on ${title}`)).toBeVisible();
  await expect(
    page.getByText(new RegExp(`^(Asha|Ravi|Zoya) and 2 others liked ${title}`)),
  ).toBeVisible();
  await expect(page.getByText("Ravi followed you")).toBeVisible();

  // Opening the list marked everything read.
  await page.reload();
  await expect(page.getByText(`Asha commented on ${title}`)).toBeVisible();
  await expect(page.getByText("New", { exact: true })).toHaveCount(0);

  // A comment notification opens the post at the comment.
  await page.getByRole("link", { name: new RegExp(`Asha commented on ${title}`) }).click();
  await expect(page).toHaveURL(/\/p\/[a-z0-9]+#comment-/);
  await expect(page.getByText("Lovely stitches!")).toBeVisible();
});

test("notification settings switch a type off and keep it off", async ({ page }) => {
  const { email, password } = createPasswordAccount({
    interests: ["crochet", "knitting", "sewing"],
  });
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/feed$/);
  await page.waitForLoadState("networkidle");

  await page.goto("/settings/notifications");
  await page.waitForLoadState("networkidle");
  const likes = page.getByRole("switch", { name: /Likes/ });
  await expect(likes).toBeChecked();
  const saved = page.waitForResponse(
    (response) =>
      response.url().includes("/api/me/notification-preferences") &&
      response.request().method() === "PUT",
  );
  await likes.uncheck();
  expect((await saved).status()).toBe(200);

  await page.reload();
  await expect(page.getByRole("switch", { name: /Likes/ })).not.toBeChecked();
  await expect(page.getByRole("switch", { name: /Comments/ })).toBeChecked();
});

test("a signed-out visitor is sent to sign-in from /notifications", async ({ page }) => {
  await page.goto("/notifications");
  await expect(page).toHaveURL(/\/sign-in\?returnTo=/);
});
