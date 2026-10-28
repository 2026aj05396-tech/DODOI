import { expect, test, type Browser, type Page } from "@playwright/test";

import { createPasswordAccount } from "./helpers/accounts";

// Profiles (roadmap P1-14; E2E-10, PRF-01…08): edit, see the changes on the public profile,
// private profiles show only the basics, unsaved changes ask before leaving.

async function signIn(page: Page) {
  const { email, password } = createPasswordAccount({
    interests: ["crochet", "knitting", "sewing"],
  });
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/feed$/);
  return { email };
}

async function visitor(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await signIn(page);
  return page;
}

function uniqueUsername(): string {
  return `maker-${Math.random().toString(36).slice(2, 9)}`;
}

/** Answers the browser's Cloudinary upload like Cloudinary would (as in admin.spec.ts). */
async function answerUploads(page: Page) {
  await page.route("https://api.cloudinary.com/v1_1/**/upload", async (route) => {
    await route.fulfill({ json: { public_id: `dodoi/local/avatars/e2e-${Date.now()}` } });
  });
}

test("E2E-10: edit the profile; others see the changes, never private fields", async ({
  page,
  browser,
}) => {
  const { email } = await signIn(page);
  const username = uniqueUsername();

  await page.goto("/profile");
  await expect(page).toHaveURL(/\/u\/e2e-/);
  await expect(page.getByRole("heading", { name: "Pick your username" })).toBeVisible();

  await page.getByRole("link", { name: "Edit profile" }).click();
  await answerUploads(page);
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "me.jpg", mimeType: "image/jpeg", buffer: Buffer.from("jpeg") });
  await expect(page.getByRole("button", { name: "Change photo" })).toBeVisible();
  await page.getByLabel("Name", { exact: true }).fill("Aanya Sharma");
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Bio", { exact: true }).fill("Watercolor most evenings.");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Profile saved").first()).toBeVisible();
  await expect(page.getByText(/You can change it again on/)).toBeVisible();

  await page.getByRole("link", { name: "View profile" }).click();
  await expect(page).toHaveURL(`/u/${username}`);
  await expect(page.getByRole("heading", { level: 1, name: "Aanya Sharma" })).toBeVisible();
  await expect(page.getByText("Watercolor most evenings.").filter({ visible: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pick your username" })).toHaveCount(0);

  const other = await visitor(browser);
  await other.goto(`/u/${username}`);
  await expect(other.getByRole("heading", { level: 1, name: "Aanya Sharma" })).toBeVisible();
  await expect(
    other.getByText("Watercolor most evenings.").filter({ visible: true }),
  ).toBeVisible();
  await expect(other.getByRole("link", { name: "Edit profile" })).toHaveCount(0);
  await expect(other.getByText(email)).toHaveCount(0);

  await page.goto("/settings/privacy");
  await page.getByLabel(/Private/).check();
  await expect(page.getByText("Your profile is private").first()).toBeVisible();

  await other.reload();
  await expect(other.getByText("This profile is private.")).toBeVisible();
  await expect(other.getByText("Watercolor most evenings.").filter({ visible: true })).toHaveCount(
    0,
  );
  await other.context().close();
});

test("skills edited in settings show on the profile", async ({ page }) => {
  await signIn(page);
  await page.goto("/settings/skills");
  const canHelp = page.getByRole("region", { name: "Can help with" });
  await canHelp.getByRole("button", { name: "Crochet" }).click();
  await page.getByRole("button", { name: "Save skills" }).click();
  await expect(page.getByText("Skills saved", { exact: false }).first()).toBeVisible();

  await page.goto("/profile");
  const skills = page.getByRole("region", { name: "Skills" });
  await expect(skills.getByText("Can help with")).toBeVisible();
  await expect(skills.getByText("Crochet").first()).toBeVisible();
});

test("leaving Edit profile with unsaved changes asks first", async ({ page }) => {
  await signIn(page);
  await page.goto("/settings/profile");
  await page.getByLabel("Name", { exact: true }).fill("Someone new");

  let asked = false;
  page.once("dialog", async (dialog) => {
    asked = true;
    await dialog.dismiss();
  });
  await page.getByRole("link", { name: "Back" }).click();

  expect(asked).toBe(true);
  await expect(page).toHaveURL(/\/settings\/profile$/);
});

test("the username prompt can be dismissed for good", async ({ page }) => {
  await signIn(page);
  await page.goto("/profile");
  const prompt = page.getByRole("heading", { name: "Pick your username" });
  await expect(prompt).toBeVisible();

  const saved = page.waitForResponse(
    (response) => response.url().endsWith("/api/me/profile") && response.ok(),
  );
  await page.getByRole("button", { name: "Dismiss" }).click();
  await saved;
  await page.reload();

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(prompt).toHaveCount(0);
});
