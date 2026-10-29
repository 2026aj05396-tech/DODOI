import { expect, test, type Page } from "@playwright/test";

import { createPasswordAccount, createPost, resetRateLimits } from "./helpers/accounts";

// Follows (roadmap P2-06, E2E-23; USER_FLOWS F-20): follow from a post, see it on the maker's
// profile, read their posts under the feed's Following chip, then unfollow from your own list.

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

test("E2E-23: a member follows a maker, sees their posts under Following, and unfollows", async ({
  page,
}) => {
  const post = createPost({ creator: true });
  const { creatorUsername, creatorName } = post;
  if (!creatorUsername || !creatorName) throw new Error("No creator");
  await signIn(page);
  await page.goto(`/p/${post.id}`);
  await page.waitForLoadState("networkidle");

  const followed = page.waitForResponse(
    (response) => response.url().includes("/api/follows/") && response.request().method() === "PUT",
  );
  await page.getByRole("button", { name: `Follow ${creatorName}` }).click();
  await expect(page.getByRole("button", { name: `Following ${creatorName}` })).toBeVisible();
  expect((await followed).status()).toBe(204);

  // Their profile shows Following, and no follower count to anyone but its owner.
  await page.goto(`/u/${creatorUsername}`);
  await expect(page.getByRole("button", { name: `Following ${creatorName}` })).toBeVisible();
  await expect(page.getByText(/\d+ followers?/)).toHaveCount(0);

  // The feed offers a Following chip with their post.
  await page.goto("/feed");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Following", exact: true }).click();
  await expect(page.getByRole("link", { name: new RegExp(`Granny square`) }).first()).toBeVisible();

  // Own lists: Following shows them; unfollow from there.
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/u\//);
  await expect(page.getByRole("link", { name: /1 following/ })).toBeVisible();
  await page.getByRole("link", { name: /1 following/ }).click();
  await expect(page).toHaveURL(/\/profile\/following$/);
  await expect(page.getByText(`@${creatorUsername}`)).toBeVisible();
  await page.getByRole("button", { name: `Following ${creatorName}` }).click();
  await expect(page.getByRole("button", { name: `Follow ${creatorName}` })).toBeVisible();
});

test("a signed-out visitor is sent to sign-in from Follow", async ({ page }) => {
  const post = createPost({ creator: true });
  await page.goto(`/p/${post.id}`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("link", { name: "Follow" }).click();
  await expect(page).toHaveURL(/\/sign-in\?returnTo=/);
});
