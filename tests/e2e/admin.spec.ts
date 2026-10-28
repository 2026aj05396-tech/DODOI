import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { createPasswordAccount, resetRateLimits } from "./helpers/accounts";

// Admin screens (roadmap P1-17, E2E-12): an admin publishes an image post and a video post end to
// end. Browser uploads to Cloudinary are answered here; the server's checks go to the local mock
// Admin API (tests/e2e/helpers/mock-cloudinary.ts).

async function signIn(page: Page, options: { admin?: boolean } = {}) {
  const { email, password } = createPasswordAccount(options);
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  // Admins skip onboarding and land on /admin; other users land on their feed.
  // Wait for the last redirect (/ → /admin → /admin/posts), or the next goto can interrupt it.
  await expect(page).toHaveURL(options.admin ? /\/admin\/posts$/ : /\/feed$/);
  await page.waitForLoadState();
}

/** Answers browser uploads like Cloudinary would, with an id in the signed folder. */
async function answerUploads(page: Page) {
  let count = 0;
  await page.route("https://api.cloudinary.com/v1_1/**/upload", async (route) => {
    count += 1;
    const isVideo = route.request().url().includes("/video/upload");
    const publicId = `dodoi/local/posts/e2e-${Date.now()}-${count}${isVideo ? "-video" : ""}`;
    await route.fulfill({ json: { public_id: publicId } });
  });
}

async function fillBasics(page: Page, title: string) {
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByLabel("Description", { exact: true }).fill("Made for the end-to-end test.");
  await page.getByRole("searchbox", { name: "Search skills to add" }).fill("croch");
  await page
    .getByRole("list", { name: "Matching skills" })
    .getByRole("button", { name: "Crochet" })
    .click();
}

async function fillAttribution(page: Page) {
  await page.getByLabel("Where it comes from").selectOption("TEAM_ORIGINAL");
  await page.getByLabel("Licence").fill("Owned");
  await page.getByLabel("Attribution text").fill("Made by the dodoi team");
}

async function publishedPostIdFrom(page: Page): Promise<string> {
  await expect(page.getByText("Published. It's live on dodoi.").first()).toBeVisible();
  // The editor moves from /admin/posts/new to the saved post's own address.
  await expect(page).toHaveURL(/\/admin\/posts\/(?!new$)[a-z0-9]+$/);
  return page.url().split("/").at(-1) ?? "";
}

test.beforeEach(() => {
  resetRateLimits();
});

test("non-admins get the 404 page at /admin", async ({ page }) => {
  await page.goto("/admin/posts");
  await expect(page.getByRole("heading", { name: "We couldn't find that page" })).toBeVisible();

  await signIn(page);
  const response = await page.goto("/admin/posts");
  expect(response?.status()).toBe(404);
});

test("E2E-12: an admin publishes an image post with steps and materials", async ({ page }) => {
  await signIn(page, { admin: true });
  await answerUploads(page);
  await page.goto("/admin/posts/new");
  const results = await new AxeBuilder({ page }).analyze();

  expect(
    results.violations.filter((v) => v.impact === "serious" || v.impact === "critical"),
  ).toEqual([]);

  await fillBasics(page, "E2E granny square");
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "square.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("fake image"),
    });
  await page.getByLabel("Alt text").fill("A teal granny square on a wooden table");
  await page.getByRole("button", { name: "Add material" }).click();
  await page.getByLabel("Material 1", { exact: true }).fill("Cotton yarn");
  await page.getByRole("button", { name: "Add step" }).click();
  await page.getByLabel("Step 1", { exact: true }).fill("Chain four and join into a ring.");
  await fillAttribution(page);

  await page.getByRole("button", { name: "Save and publish" }).click();
  const postId = await publishedPostIdFrom(page);

  const detail = await page.evaluate(
    async (id) => (await fetch(`/api/posts/${id}`)).json(),
    postId,
  );
  expect(detail).toMatchObject({
    title: "E2E granny square",
    skills: [expect.objectContaining({ name: "Crochet" })],
    materials: [expect.objectContaining({ name: "Cotton yarn" })],
    steps: [expect.objectContaining({ text: "Chain four and join into a ring." })],
    coverMedia: expect.objectContaining({ altText: "A teal granny square on a wooden table" }),
  });
});

test("E2E-12: an admin publishes a video post", async ({ page }) => {
  await signIn(page, { admin: true });
  await answerUploads(page);
  await page.goto("/admin/posts/new");

  await fillBasics(page, "E2E crochet clip");
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "clip.mp4",
      mimeType: "video/mp4",
      buffer: Buffer.from("fake video"),
    });
  await expect(page.getByLabel("Description (optional)")).toBeVisible();
  await fillAttribution(page);
  await page.getByRole("button", { name: "Save and publish" }).click();
  const postId = await publishedPostIdFrom(page);

  const detail = await page.evaluate(
    async (id) => (await fetch(`/api/posts/${id}`)).json(),
    postId,
  );
  expect(detail.media).toEqual([expect.objectContaining({ type: "VIDEO", durationSec: 12 })]);
});

test("publishing an incomplete post shows what is missing on each field", async ({ page }) => {
  await signIn(page, { admin: true });
  await page.goto("/admin/posts/new");

  await page.getByLabel("Title", { exact: true }).fill("E2E incomplete");
  await page.getByRole("button", { name: "Save and publish" }).click();

  await expect(page.getByText("This post isn't ready to publish yet.")).toBeVisible();
  await expect(page.getByText("Add at least one skill.")).toBeVisible();
  await expect(page.getByText("Add at least one photo or video.")).toBeVisible();
  // Saved as a draft, so the editor now has its own address.
  await expect(page).toHaveURL(/\/admin\/posts\/(?!new$)[a-z0-9]+$/);
});

test("P1-19: an admin sees seed coverage against the launch minimums", async ({ page }) => {
  await signIn(page, { admin: true });
  await page
    .getByRole("navigation", { name: "Admin" })
    .getByRole("link", { name: "Coverage" })
    .click();

  await expect(page.getByRole("heading", { level: 1, name: "Coverage" })).toBeVisible();
  // The summary names the gaps (text, not colour alone).
  await expect(
    page.getByRole("status").filter({ hasText: /gaps? before launch|minimum is met/ }),
  ).toBeVisible();
  for (const section of ["Skills", "Post types", "Themes"]) {
    await expect(
      page.getByRole("heading", { level: 2, name: new RegExp(`^${section}`) }),
    ).toBeVisible();
  }

  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter((v) => v.impact === "serious" || v.impact === "critical"),
  ).toEqual([]);
});
