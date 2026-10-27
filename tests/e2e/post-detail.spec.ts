import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { createPasswordAccount, createPost } from "./helpers/accounts";

// Post detail (roadmap P1-20, E2E-07 without the skill-page step, which arrives with P1-26).
// Media URLs point at the fake "e2e-cloud" Cloudinary account, so images don't load; alt texts and
// layout still do.

// Without the Web Share API (desktop Chrome), Share copies the link.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { value: undefined });
  });
});

async function expectNoSeriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(blocking).toEqual([]);
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/feed$/);
}

test("a signed-out visitor can read a shared post and open a related one", async ({ page }) => {
  const { id, relatedId } = createPost();

  await page.goto(`/p/${id}`);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^Granny square/);
  await expect(page.getByText("via dodoi editors", { exact: true })).toBeVisible();
  await expect(page.getByText("Beginner", { exact: true })).toBeVisible();
  await expect(page.getByText("45 min", { exact: true })).toBeVisible();
  await expect(page.getByText("Cotton yarn")).toBeVisible();
  await expect(
    page.getByRole("listitem").filter({ hasText: "Work the first round." }),
  ).toBeVisible();
  const source = page.getByRole("region", { name: "Source" });
  await expect(source).toContainText("License: CC BY 4.0 · Added by dodoi editors");
  await expect(source.getByRole("link", { name: /commons\.wikimedia\.org/ })).toHaveAttribute(
    "href",
    "https://commons.wikimedia.org/wiki/File:Granny_square.jpg",
  );
  await expect(page.getByRole("link", { name: "Log in" })).toHaveAttribute(
    "href",
    `/sign-in?returnTo=${encodeURIComponent(`/p/${id}`)}`,
  );
  await expectNoSeriousViolations(page);

  // Other runs' posts share the skill, so pick this run's related post by its link.
  await page.locator(`a[href="/p/${relatedId}"]`).click();
  await expect(page).toHaveURL(`/p/${relatedId}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^First amigurumi/);
});

test("the gallery steps through photos and plays a video when tapped", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Arrows and thumbnails are shown from 768px; mobile swipes.");
  const { id } = createPost();
  await page.goto(`/p/${id}`);
  const gallery = page.getByRole("region", { name: "Photos and videos" });

  await expect(gallery.getByText("1 / 4")).toBeVisible();
  await gallery.getByRole("button", { name: "Next photo or video" }).click();
  await expect(gallery.getByText("2 / 4")).toBeVisible();

  await gallery.getByRole("button", { name: "Show 4 of 4" }).click();
  await expect(gallery.getByText("4 / 4")).toBeVisible();
  await gallery.getByRole("button", { name: "Play video: Hands working the first round" }).click();
  await expect(gallery.locator("video")).toBeVisible();
});

test("Share copies the link and coming-soon actions don't act", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const { id } = createPost();
  await page.goto(`/p/${id}`);

  await page.getByRole("button", { name: "Share" }).filter({ visible: true }).click();
  // The toast text is also in its screen-reader announcement.
  await expect(page.getByText("Link copied").first()).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(
    new RegExp(`/p/${id}$`),
  );

  // aria-disabled controls stay tappable for real users; Playwright needs `force` to click them.
  await page
    .getByRole("button", { name: /Save to collection\s*, coming soon/ })
    .filter({ visible: true })
    .click({ force: true });
  await expect(page.getByRole("tooltip")).toHaveText("Coming soon");
  await expect(page).toHaveURL(`/p/${id}`);
});

test("signed-in users get the app shell; on mobile the post is full screen", async ({
  page,
  isMobile,
}) => {
  const { email, password } = createPasswordAccount();
  await signIn(page, email, password);
  const { id } = createPost();

  await page.goto(`/p/${id}`);

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Log in" })).toHaveCount(0);
  if (isMobile) {
    await expect(page.getByRole("navigation", { name: "Main" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Back" })).toBeVisible();
  } else {
    await expect(page.getByRole("navigation", { name: "Main" }).first()).toBeVisible();
  }
});

test("drafts are not found for visitors", async ({ page }) => {
  const { id } = createPost({ status: "DRAFT" });

  await page.goto(`/p/${id}`);

  // The page streams, so the status stays 200 (Next.js docs); visitors see the 404 page and
  // search engines are told not to index it.
  await expect(page.getByRole("heading", { name: "We couldn't find that page" })).toBeVisible();
  expect(await page.locator('meta[name="robots"][content="noindex"]').count()).toBeGreaterThan(0);
});

test("E2E-17: ticks and done steps are saved and come back on reload and another device", async ({
  page,
  browser,
}) => {
  const { email, password } = createPasswordAccount();
  await signIn(page, email, password);
  const { id } = createPost();
  await page.goto(`/p/${id}`);

  const material = page.getByRole("checkbox", { name: /Cotton yarn/ });
  await material.check();
  await expect(page.getByText("1 of 1 · saved to your account")).toBeVisible();
  const firstStep = page.getByRole("button", { name: "Step 1 done" });
  const saved = page.waitForResponse(
    (response) => response.url().endsWith(`/api/posts/${id}/progress`) && response.ok(),
  );
  await firstStep.click();
  await saved;
  await expect(firstStep).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { name: "Step 1 of 2 · progress saved" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("checkbox", { name: /Cotton yarn/ })).toBeChecked();
  await expect(page.getByRole("button", { name: "Step 1 done" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // Undo on a second device, then the first device sees it after a reload.
  const otherDevice = await browser.newContext();
  const otherPage = await otherDevice.newPage();
  await signIn(otherPage, email, password);
  await otherPage.goto(`/p/${id}`);
  const otherStep = otherPage.getByRole("button", { name: "Step 1 done" });
  await expect(otherStep).toHaveAttribute("aria-pressed", "true");
  const undone = otherPage.waitForResponse(
    (response) => response.url().endsWith(`/api/posts/${id}/progress`) && response.ok(),
  );
  await otherStep.click();
  await undone;
  await otherDevice.close();

  await page.reload();
  await expect(page.getByRole("button", { name: "Step 1 done" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(page.getByRole("checkbox", { name: /Cotton yarn/ })).toBeChecked();
});

test("Next step scrolls to the first unfinished step", async ({ page }) => {
  const { email, password } = createPasswordAccount();
  await signIn(page, email, password);
  const { id } = createPost();
  await page.goto(`/p/${id}`);

  await page.getByRole("button", { name: "Step 1 done" }).click();
  await page.getByRole("button", { name: "Next step" }).click();

  await expect(page.getByRole("button", { name: "Step 2 done" })).toBeFocused();
});

test("signed-out visitors are sent to sign-in when they tick something", async ({ page }) => {
  const { id } = createPost();
  await page.goto(`/p/${id}`);

  await page.getByRole("button", { name: "Step 1 done" }).click();

  await expect(page).toHaveURL(`/sign-in?returnTo=${encodeURIComponent(`/p/${id}`)}`);
});
