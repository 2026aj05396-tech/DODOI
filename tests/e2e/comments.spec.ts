import { expect, test, type Page } from "@playwright/test";

import { createPasswordAccount, createPost, resetRateLimits } from "./helpers/accounts";

// Comments (roadmap P2-04, E2E-21; USER_FLOWS F-19): comment, reply, edit and delete on a post.

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

test("E2E-21: a member comments, replies, edits and deletes", async ({ page }) => {
  const post = createPost();
  await signIn(page);
  await page.goto(`/p/${post.id}`);
  await page.waitForLoadState("networkidle");

  const comments = page.getByRole("region", { name: /^Comments/ });
  await expect(comments.getByText("No comments yet. Be the first to say something.")).toBeVisible();

  await comments.getByLabel("Add a comment").fill("Lovely colours!");
  await comments.getByRole("button", { name: "Post" }).click();
  await expect(comments.getByText("Lovely colours!")).toBeVisible();
  await expect(comments.getByRole("heading", { name: "Comments (1)" })).toBeVisible();

  // The thread moves to the other placement past 1024px; the count and comments come along.
  const size = page.viewportSize();
  if (!size) throw new Error("No viewport");
  await page.setViewportSize({ width: size.width >= 1024 ? 600 : 1280, height: size.height });
  await expect(comments.getByRole("heading", { name: "Comments (1)" })).toBeVisible();
  await expect(comments.getByText("Lovely colours!")).toBeVisible();
  await page.setViewportSize(size);

  await comments.getByRole("button", { name: /^Reply/ }).click();
  const reply = comments.getByLabel(/^Reply to thread/);
  await expect(reply).toHaveValue(/^@\S+ $/);
  await reply.pressSequentially("Thank you!");
  await comments.getByRole("button", { name: "Reply", exact: true }).click();
  await expect(comments.getByText(/Thank you!/)).toBeVisible();
  await expect(comments.getByRole("heading", { name: "Comments (2)" })).toBeVisible();

  await comments
    .getByRole("button", { name: /^Options for/ })
    .first()
    .click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  const edit = comments.getByLabel(/^Edit comment/);
  await edit.fill("Lovely colours, so cheerful!");
  await comments.getByRole("button", { name: "Save" }).click();
  await expect(comments.getByText("Lovely colours, so cheerful!")).toBeVisible();
  await expect(comments.getByText(/edited/)).toBeVisible();

  // The comment has a reply, so deleting it leaves "Comment deleted" and the reply.
  await comments
    .getByRole("button", { name: /^Options for/ })
    .first()
    .click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(comments.getByText("Comment deleted")).toBeVisible();
  await expect(comments.getByText(/Thank you!/)).toBeVisible();

  await page.reload();
  await expect(comments.getByText("Comment deleted")).toBeVisible();
  await expect(comments.getByRole("heading", { name: "Comments (1)" })).toBeVisible();
});

test("signed-out visitors see the count and are asked to sign in", async ({ page }) => {
  const post = createPost();
  await page.goto(`/p/${post.id}`);
  const comments = page.getByRole("region", { name: /^Comments/ });
  await expect(comments.getByRole("link", { name: "Sign in" })).toBeVisible();
  await expect(comments.getByRole("heading", { name: "Comments (0)" })).toBeVisible();
});
