import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import { createFeedPosts, createPasswordAccount } from "./helpers/accounts";

// Search, Explore and skill pages (roadmap P1-26; E2E-05, E2E-09, E2E-15's skill-page step).

async function signIn(page: Page, interests = ["crochet", "knitting", "sewing"]) {
  const { email, password } = createPasswordAccount({ interests });
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/feed$/);
}

async function searchFor(page: Page, term: string) {
  await page.goto("/explore");
  const box = page.getByRole("searchbox", { name: "Search skills, projects and makers" });
  await box.fill(term);
  await box.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/search\\?q=`));
}

test(
  "E2E-09: part of a word finds the skill and its posts; nonsense shows the no-results state",
  { tag: "@smoke" },
  async ({ page }) => {
    const craft = createFeedPosts(2);
    await signIn(page);
    const partial = craft.skillName.slice(0, -3);

    await searchFor(page, partial);

    const skills = page.getByRole("region", { name: "Skills" });
    await expect(skills.getByRole("link", { name: new RegExp(craft.skillName) })).toBeVisible();
    const posts = page.getByRole("region", { name: "Posts" });
    await expect(
      posts.locator(`a[href="/p/${craft.ids[0]}"]`).filter({ visible: true }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Skills", exact: true }).click();
    await expect(page).toHaveURL(/type=skills/);
    await expect(page.getByRole("link", { name: new RegExp(craft.skillName) })).toBeVisible();

    await searchFor(page, `zq${randomUUID().slice(0, 6)}xv`);
    await expect(page.getByRole("heading", { name: /No results for/ })).toBeVisible();
  },
);

test("E2E-05: a custom interest added by one user is found by another and has a skill page", async ({
  page,
  browser,
}) => {
  const name = `Kintsugi ${randomUUID().slice(0, 6)}`;
  await signIn(page);
  await page.goto("/settings/skills");
  const interests = page.getByRole("region", { name: "Interests" });
  await interests.getByRole("button", { name: "+ Add your own" }).click();
  await interests.getByLabel("Your own interest").fill(name);
  await interests.getByRole("button", { name: "Add", exact: true }).click();
  await expect(interests.getByRole("button", { name, exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Save skills" }).click();
  await expect(page.getByText("Skills saved", { exact: false }).first()).toBeVisible();

  const other = await (await browser.newContext()).newPage();
  await signIn(other);
  await searchFor(other, name.split(" ")[0] ?? name);
  await other
    .getByRole("link", { name: new RegExp(name) })
    .first()
    .click();
  await expect(other.getByRole("heading", { level: 1, name })).toBeVisible();
  await other.context().close();
});

test("a skill page adds the skill to your interests", async ({ page }) => {
  const craft = createFeedPosts(1);
  await signIn(page);
  await page.goto(`/s/${craft.skillSlug}`);

  await expect(page.getByRole("heading", { level: 1, name: craft.skillName })).toBeVisible();
  await expect(
    page.locator(`a[href="/p/${craft.ids[0]}"]`).filter({ visible: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add to my interests" }).click();
  await expect(page.getByRole("button", { name: "In your interests" })).toBeVisible();

  await page.goto("/feed");
  await expect(page.getByRole("button", { name: craft.skillName })).toBeVisible();
});

test("E2E-15: Try it on the New to you card opens the skill page", async ({ page, isMobile }) => {
  createFeedPosts(1);
  await signIn(page);
  const card = isMobile
    ? page.getByRole("region", { name: "Your feed" })
    : page.getByRole("complementary", { name: "Suggestions" });

  await card.getByRole("link", { name: /^Try it/ }).click();

  await expect(page).toHaveURL(/\/s\/[^/]+$/);
  await expect(page.getByRole("button", { name: "Add to my interests" })).toBeVisible();
});

test("Explore shows skills to try and links to all skills", async ({ page }) => {
  await signIn(page);
  await page.goto("/explore");
  await expect(page.getByRole("heading", { level: 1, name: "Explore" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Use what you have" })).toBeVisible();

  await page.getByRole("link", { name: "See all" }).click();
  await expect(page).toHaveURL(/\/explore\/skills$/);
  await page.getByRole("searchbox", { name: "Filter skills" }).fill("croch");
  await expect(page.getByRole("link", { name: /Crochet/ })).toBeVisible();
});
