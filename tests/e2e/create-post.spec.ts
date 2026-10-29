import { expect, test, type Page } from "@playwright/test";

import { createPasswordAccount, resetRateLimits } from "./helpers/accounts";

// Create post, Instagram-style (roadmap P2-02, E2E-19; USER_FLOWS F-17): pick → arrange → details →
// share, then the post page offers Edit. Browser uploads to Cloudinary are answered here; the
// server's checks go to the local mock Admin API (tests/e2e/helpers/mock-cloudinary.ts).

const PHOTO = { mimeType: "image/jpeg", buffer: Buffer.from("e2e photo") };
/** A real (tiny) JPEG, for the photo editor, which draws the picked file. */
const REAL_PHOTO = {
  name: "small.jpg",
  mimeType: "image/jpeg",
  buffer: Buffer.from(
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIfIiEmKzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9Pjv/2wBDAQoLCw4NDhwQEBw7KCIoOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozv/wAARCAAwAEADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDsqKKK4T3QooooAKKKKACiiigDmv8AhL/+nH/yN/8AY0f8Jf8A9OP/AJG/+xo/4RD/AKfv/IP/ANlR/wAIh/0/f+Qf/sq9D/ZP6uc377+rB/wl/wD04/8Akb/7Gj/hL/8Apx/8jf8A2NH/AAiH/T9/5B/+yo/4RD/p+/8AIP8A9lR/sn9XD99/Vg/4S/8A6cf/ACN/9jR/wl//AE4/+Rv/ALGj/hEP+n7/AMg//ZUf8Ih/0/f+Qf8A7Kj/AGT+rh++/qwf8Jf/ANOP/kb/AOxo/wCEv/6cf/I3/wBjR/wiH/T9/wCQf/sqP+EQ/wCn7/yD/wDZUf7J/Vw/ff1Y6WiiivPOkKKKKACiiigAooooA//Z",
    "base64",
  ),
};

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
    await route.fulfill({
      json: { public_id: `dodoi/local/posts/e2e-create-${Date.now()}-${count}` },
    });
  });
}

/** The screen's next action (top right, and the bottom bar on phones). */
function nextAction(page: Page, name: string) {
  return page.getByRole("button", { name, exact: true }).first();
}

test.beforeEach(() => {
  resetRateLimits();
});

test("E2E-19: a maker picks photos, describes them, adds details and shares a post", async ({
  page,
}) => {
  await signIn(page);
  await answerUploads(page);

  await page.getByRole("link", { name: "Create" }).filter({ visible: true }).first().click();
  await expect(page.getByRole("heading", { name: "Add photos of what you made" })).toBeVisible();
  await page.waitForLoadState();

  await page.locator("input[type=file][multiple]").setInputFiles([
    { name: "hoop.jpg", ...PHOTO },
    { name: "detail.jpg", ...PHOTO },
  ]);
  await expect(page.getByText("Uploaded")).toHaveCount(2);
  // The first finished upload creates the draft and the address becomes its own.
  await expect(page).toHaveURL(/\/create\/[a-z0-9]+$/);

  await nextAction(page, "Next").click();
  await page.getByLabel("Describe photo 1").fill("A blue granny square");
  await page.getByLabel("Describe photo 2").fill("The square up close");
  await page.getByLabel("Describe photo 2").blur();
  await expect(page.getByText("2 of 2 photos described")).toBeVisible();
  await page.getByRole("button", { name: "Move 2 earlier" }).click();
  await expect(page.getByLabel("Describe photo 1")).toHaveValue("The square up close");

  await nextAction(page, "Next").click();
  await page.getByRole("textbox", { name: "Title" }).fill("My first granny square");
  await page.getByRole("button", { name: /^Crafts/ }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /^Crochet/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText("Saved as draft")).toBeVisible();

  // Sharing without the own-work confirmation (CRT-08) says what is missing.
  await nextAction(page, "Post").click();
  await expect(page.getByText("Tick this to post it.")).toBeVisible();
  await page.getByRole("checkbox", { name: /This is my own work/ }).check();
  await nextAction(page, "Post").click();

  await expect(page.getByRole("heading", { name: "Posted!" })).toBeVisible();
  await page.getByRole("link", { name: "See your post" }).click();
  await expect(page).toHaveURL(/\/p\/[a-z0-9]+$/);
  await expect(
    page.getByRole("heading", { name: "My first granny square", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Edit post" }).filter({ visible: true }),
  ).toBeVisible();

  // Your own post says it is live (PO decision 2026-10-29).
  await expect(page.getByText("Live · showing in feeds")).toBeVisible();

  // The profile opens on Posts once there are any (P2-02).
  await page.goto("/profile");
  await expect(page.getByRole("tab", { name: "Posts" })).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("tabpanel").getByText("My first granny square").first(),
  ).toBeVisible();
});

/** Opens Create from the navigation (a hydrated page) and picks one photo; returns the draft URL. */
async function startDraft(page: Page): Promise<string> {
  await page.getByRole("link", { name: "Create" }).filter({ visible: true }).first().click();
  await expect(page.getByRole("heading", { name: "Add photos of what you made" })).toBeVisible();
  await page.locator("input[type=file][multiple]").setInputFiles([{ name: "a.jpg", ...PHOTO }]);
  await expect(page).toHaveURL(/\/create\/[a-z0-9]+$/);
  return page.url();
}

test("a draft can be deleted, and its address is gone afterwards", async ({ page }) => {
  await signIn(page);
  await answerUploads(page);
  const draftUrl = await startDraft(page);

  await nextAction(page, "Next").click();
  await nextAction(page, "Next").click();
  await page.getByRole("button", { name: "Delete draft" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByText("Draft deleted").first()).toBeVisible();

  // Streamed pages answer 200 and render the not-found page (as other detail pages do).
  await page.goto(draftUrl);
  await expect(page.getByRole("heading", { name: "We couldn't find that page" })).toBeVisible();
});

test("Edit on a shared post saves changes live", async ({ page }) => {
  await signIn(page);
  await answerUploads(page);
  await startDraft(page);
  await nextAction(page, "Next").click();
  await page.getByLabel("Describe photo 1").fill("A teal granny square");
  await nextAction(page, "Next").click();
  await page.getByRole("textbox", { name: "Title" }).fill("Granny square, take one");
  await page.getByRole("button", { name: /^Crafts/ }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /^Crochet/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Done" }).click();
  await page.getByRole("checkbox", { name: /This is my own work/ }).check();
  await nextAction(page, "Post").click();
  await page.getByRole("link", { name: "See your post" }).click();

  await page.getByRole("link", { name: "Edit post" }).filter({ visible: true }).first().click();
  await expect(page.getByRole("heading", { name: "Edit post" })).toBeVisible();
  await page.getByRole("textbox", { name: "Title" }).fill("Granny square, take two");
  await expect(page.getByText("Unsaved changes")).toBeVisible();
  await nextAction(page, "Save").click();

  await expect(page).toHaveURL(/\/p\/[a-z0-9]+$/);
  await expect(
    page.getByRole("heading", { name: "Granny square, take two", level: 1 }),
  ).toBeVisible();
});

test("a picked photo is cropped square in the photo editor and uploaded again", async ({
  page,
}) => {
  await signIn(page);
  let uploads = 0;
  await page.route("https://api.cloudinary.com/v1_1/**/upload", async (route) => {
    uploads += 1;
    await route.fulfill({
      json: { public_id: `dodoi/local/posts/e2e-edit-${Date.now()}-${uploads}` },
    });
  });
  await page.getByRole("link", { name: "Create" }).filter({ visible: true }).first().click();
  await expect(page.getByRole("heading", { name: "Add photos of what you made" })).toBeVisible();
  await page.locator("input[type=file][multiple]").setInputFiles([REAL_PHOTO]);
  await expect(page.getByText("Uploaded")).toHaveCount(1);

  await page.getByRole("button", { name: "Edit photo" }).click();
  const editor = page.getByRole("dialog", { name: "Edit photo" });
  await editor.getByRole("radio", { name: "Square" }).click();
  await editor.getByRole("button", { name: "Rotate right" }).click();
  await editor.getByRole("button", { name: "Use this photo" }).click();

  await expect(editor).toHaveCount(0);
  await expect(page.getByText("Uploaded")).toHaveCount(1);
  expect(uploads).toBe(2);
});

test("a tutorial needs two steps and a time, and a step can have a described photo", async ({
  page,
}) => {
  await signIn(page);
  await answerUploads(page);
  await startDraft(page);
  await nextAction(page, "Next").click();
  await page.getByLabel("Describe photo 1").fill("A finished pinch pot");
  await nextAction(page, "Next").click();
  await page.getByRole("textbox", { name: "Title" }).fill("Pinch pot in five steps");
  await page.getByRole("button", { name: /^Type/ }).click();
  await page.getByRole("radio", { name: /Tutorial/ }).click();
  await page.getByRole("button", { name: "Done" }).click();
  await page.getByRole("button", { name: /^Crafts/ }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /^Crochet/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Done" }).click();
  await page.getByRole("checkbox", { name: /This is my own work/ }).check();

  // Post opens the sheet that is missing something: the steps.
  await nextAction(page, "Post").click();
  const sheet = page.getByRole("dialog", { name: "Materials and steps" });
  await expect(sheet.getByText("A tutorial needs at least two steps.")).toBeVisible();
  for (const step of ["Roll a ball of clay", "Press your thumb in and pinch"]) {
    await sheet.getByLabel(/^Add step/).fill(step);
    await page.keyboard.press("Enter");
  }
  await sheet.getByLabel("Photo for step 1").setInputFiles([{ name: "step.jpg", ...PHOTO }]);
  await sheet.getByLabel("Describe the photo").fill("A smooth ball of clay");
  await sheet.getByLabel("Describe the photo").blur();
  await sheet.getByRole("button", { name: "Done" }).click();

  await page.getByRole("button", { name: /^Difficulty and time/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "30 min" }).click();
  await page.getByRole("button", { name: "Done" }).click();

  await nextAction(page, "Post").click();
  await expect(page.getByRole("heading", { name: "Posted!" })).toBeVisible();
});
