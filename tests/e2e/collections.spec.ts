import { expect, test, type Browser, type Page } from "@playwright/test";

import { createPasswordAccount, createPost } from "./helpers/accounts";

// Saved and collections (roadmap P1-25; E2E-08, E2E-11, USER_FLOWS F-09).

async function signIn(page: Page) {
  const { email, password } = createPasswordAccount();
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/feed$/);
}

async function newCollectionFromPost(page: Page, postId: string, name: string) {
  await page.goto(`/p/${postId}`);
  await page.getByRole("button", { name: "Save to collection" }).filter({ visible: true }).click();
  const picker = page.getByRole("dialog", { name: "Save to collection" });
  await picker.getByRole("button", { name: "New collection" }).click();
  await picker.getByLabel("Collection name").fill(name);
  await picker.getByRole("button", { name: "Create and add" }).click();
  await expect(picker.getByRole("checkbox", { name: new RegExp(name) })).toBeChecked();
  await picker.getByRole("button", { name: "Done" }).click();
  await expect(picker).toBeHidden();
}

const allSaved = (page: Page) => page.getByRole("region", { name: "All saved" });

test("E2E-08: save → new collection → rename → delete; the post stays in All saved", async ({
  page,
}) => {
  await signIn(page);
  const { id } = createPost();

  await newCollectionFromPost(page, id, "Crochet ideas");

  await page.goto("/saved");
  const tile = page.getByRole("link", { name: /Crochet ideas/ });
  await expect(tile).toContainText("1 saved · Private");
  await expect(allSaved(page).locator(`a[href="/p/${id}"]`)).toBeVisible();

  await tile.click();
  await expect(page.getByRole("heading", { level: 1, name: "Crochet ideas" })).toBeVisible();
  await page.getByRole("button", { name: "Rename" }).click();
  await page.getByLabel("Collection name").fill("Crochet favourites");
  await page.getByRole("button", { name: "Save name" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Crochet favourites" })).toBeVisible();

  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Saved posts will stay in All saved.")).toBeVisible();
  await page.getByRole("button", { name: "Delete collection" }).click();

  await expect(page).toHaveURL(/\/saved$/);
  await expect(page.getByRole("link", { name: /Crochet favourites/ })).toHaveCount(0);
  await expect(allSaved(page).locator(`a[href="/p/${id}"]`)).toBeVisible();
});

async function otherUser(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page);
  return page;
}

test("E2E-11: another user's private collection is not found; a public one opens", async ({
  page,
  browser,
}) => {
  await signIn(page);
  const { id } = createPost();
  await newCollectionFromPost(page, id, "Secret stash");
  await page.goto("/saved");
  await page.getByRole("link", { name: /Secret stash/ }).click();
  await expect(page).toHaveURL(/\/saved\/[^/]+$/);
  const url = page.url();

  const visitor = await otherUser(browser);
  await visitor.goto(url);
  await expect(visitor.getByRole("heading", { name: "We couldn't find that page" })).toBeVisible();
  await expect(visitor.getByText("Secret stash")).toHaveCount(0);

  // The owner has no public profile yet (profiles arrive in P1-14), so even a public collection
  // stays hidden from others (OD-10) — the private case above is what E2E-11 checks.
  await visitor.context().close();
});

test("unsaving shows Undo, which puts the post back in its collections", async ({ page }) => {
  await signIn(page);
  const { id } = createPost();
  await newCollectionFromPost(page, id, "Keepers");

  await page.goto("/saved");
  const card = allSaved(page)
    .locator("article")
    .filter({ has: page.locator(`a[href="/p/${id}"]`) });
  const restored = page.waitForResponse(
    (response) => response.url().includes(`/items/${id}`) && response.ok(),
  );
  await card.getByRole("button", { name: /^Save / }).click();
  await expect(card.getByRole("button", { name: /^Save / })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await page.getByRole("button", { name: "Undo" }).click();
  await restored;

  await page.reload();
  await expect(page.getByRole("link", { name: /Keepers/ })).toContainText("1 saved");
});
