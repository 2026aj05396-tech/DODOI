import { expect, test, type Page } from "@playwright/test";

import { createPasswordAccount, createPost, resetRateLimits } from "./helpers/accounts";

// Likes (roadmap P2-05, E2E-22; USER_FLOWS F-20): the heart on a post stays filled after a reload;
// signed-out visitors are sent to sign-in; a non-author never sees a like count.

async function signIn(page: Page) {
  const { email, password } = createPasswordAccount({
    interests: ["crochet", "knitting", "sewing"],
  });
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

test("E2E-22: a member likes a post, it stays liked after a reload, and unlikes", async ({
  page,
}) => {
  const post = createPost();
  await signIn(page);
  await page.goto(`/p/${post.id}`);
  await page.waitForLoadState("networkidle");

  const heart = page.getByRole("button", { name: "Like", exact: true }).filter({ visible: true });
  const liked = page.waitForResponse(
    (response) => response.url().includes("/like") && response.request().method() === "PUT",
  );
  await heart.click();
  await expect(
    page.getByRole("button", { name: "Unlike" }).filter({ visible: true }),
  ).toBeVisible();
  expect((await liked).status()).toBe(204);
  await expect(page.getByText(/\d+ likes?$/)).toHaveCount(0);

  await page.reload();
  const unlike = page.getByRole("button", { name: "Unlike" }).filter({ visible: true });
  await expect(unlike).toHaveAttribute("aria-pressed", "true");
  await unlike.click();
  await expect(
    page.getByRole("button", { name: "Like", exact: true }).filter({ visible: true }),
  ).toBeVisible();
});

test("a signed-out visitor is sent to sign-in from the heart", async ({ page }) => {
  const post = createPost();
  await page.goto(`/p/${post.id}`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Like", exact: true }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/sign-in\?returnTo=/);
});
