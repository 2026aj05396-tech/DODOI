import { expect, test, type Page } from "@playwright/test";

import { createPasswordAccount, createPost, resetRateLimits } from "./helpers/accounts";

// Creative journal (roadmap P2-03, E2E-20; USER_FLOWS F-18, design `1g`): a project with entries,
// finished and shown on the profile, shared as a post; "Start as my project" from a tutorial.

const PHOTO = { mimeType: "image/jpeg", buffer: Buffer.from("e2e photo") };

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

async function answerUploads(page: Page) {
  let count = 0;
  await page.route("https://api.cloudinary.com/v1_1/**/upload", async (route) => {
    count += 1;
    const folder = route.request().postDataBuffer()?.toString().includes("entries")
      ? "entries"
      : "posts";
    await route.fulfill({
      json: { public_id: `dodoi/local/${folder}/e2e-journal-${Date.now()}-${count}` },
    });
  });
}

test.beforeEach(() => {
  resetRateLimits();
});

test("E2E-20: a maker keeps a project, finishes it, shows it on the profile and shares it", async ({
  page,
}) => {
  await signIn(page);
  await answerUploads(page);
  await page.goto("/journal");
  await page.waitForLoadState("networkidle");

  await page.getByRole("button", { name: "New project" }).first().click();
  await page.getByLabel("Name").fill("Granny square blanket");
  await page.getByRole("dialog").getByRole("button", { name: "Crochet" }).click();
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page).toHaveURL(/\/projects\/[a-z0-9]+$/);
  await expect(page.getByText("Project · in progress")).toBeVisible();

  const addEntry = page
    .getByRole("button", { name: "Add progress entry" })
    .filter({ visible: true });
  await addEntry.click();
  let sheet = page.getByRole("dialog");
  await sheet.getByLabel("Title (optional)").fill("Choosing yarn");
  await sheet.getByLabel("What happened").fill("Four colours of cotton.");
  await sheet.getByRole("button", { name: "Add entry" }).click();
  await expect(page.getByText("Entry 1 · today")).toBeVisible();

  await addEntry.click();
  sheet = page.getByRole("dialog");
  await sheet.getByLabel("Title (optional)").fill("Twelve squares done");
  await sheet
    .getByLabel("Add photos to this entry")
    .setInputFiles([{ name: "squares.jpg", ...PHOTO }]);
  await expect(sheet.getByRole("button", { name: "Add entry" })).toBeEnabled();
  await sheet.getByRole("button", { name: "Add entry" }).click();
  // Newest first: entry 2 comes before entry 1.
  await expect(page.getByRole("heading", { level: 3 })).toHaveText([
    "Twelve squares done",
    "Choosing yarn",
  ]);

  await page.getByRole("button", { name: "Project options" }).click();
  await page.getByRole("menuitem", { name: "Show on my profile" }).click();
  await expect(page.getByText("It shows on your profile now").first()).toBeVisible();
  await page.getByRole("button", { name: "Project options" }).click();
  await page.getByRole("menuitem", { name: "Mark as finished" }).click();
  await expect(page.getByText("Project · finished")).toBeVisible();
  const projectUrl = page.url();

  await page.goto("/profile");
  await page.getByRole("tab", { name: "Projects" }).click();
  await expect(page.getByRole("tabpanel").getByText("Granny square blanket")).toBeVisible();

  // Post (JRN-05): a draft post from the latest entry, opened on Details.
  await page.goto(projectUrl);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Post", exact: true }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/create\/[a-z0-9]+$/);
  await expect(page.getByRole("textbox", { name: "Title" })).toHaveValue("Granny square blanket");
  await expect(page.getByRole("button", { name: /^Type/ })).toContainText("Finished");
});

test("Start as my project copies a tutorial's materials into a checklist", async ({ page }) => {
  const tutorial = createPost();
  await signIn(page);
  await page.goto(`/p/${tutorial.id}`);
  await page.waitForLoadState("networkidle");

  await page.getByRole("button", { name: "Start as my project" }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/projects\/[a-z0-9]+$/);
  await expect(page.getByText("Started from")).toBeVisible();
  const saved = page.waitForResponse(
    (response) => response.url().includes("/materials/") && response.request().method() === "PUT",
  );
  await page.getByRole("checkbox").first().check();
  expect((await saved).status()).toBe(204);
  await page.reload();
  await expect(page.getByRole("checkbox").first()).toBeChecked();
});
