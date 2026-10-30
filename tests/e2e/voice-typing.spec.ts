import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { createPasswordAccount, createPost, resetRateLimits } from "./helpers/accounts";

// Voice typing (roadmap P2-10, E2E-37; USER_FLOWS F-31). Real speech cannot be automated, so a fake
// SpeechRecognition is injected before the page loads and the test makes the "browser" hear words.
// Nothing here uses a microphone or a network speech service.

const PHOTO = { mimeType: "image/jpeg", buffer: Buffer.from("e2e photo") };

type FakeSpeech = {
  running: boolean;
  hearInterim: (text: string) => void;
  hearFinal: (text: string) => void;
  fail: (error: string) => void;
};

/** Adds a fake speech API before any page script runs; `mode: "none"` leaves it out (Firefox). */
async function installSpeech(page: Page, mode: "fake" | "none", noteSeen = true) {
  await page.addInitScript(
    ({ mode: how, noteSeen: seen }) => {
      if (seen) window.localStorage.setItem("dodoi:voice-typing-note", "1");
      if (how === "none") {
        // Chromium has its own; remove it to behave like Firefox.
        Reflect.deleteProperty(window, "webkitSpeechRecognition");
        Reflect.deleteProperty(window, "SpeechRecognition");
        return;
      }
      type Handler = ((event: unknown) => void) | null;
      class Fake {
        lang = "";
        continuous = false;
        interimResults = false;
        maxAlternatives = 1;
        onstart: Handler = null;
        onresult: Handler = null;
        onerror: Handler = null;
        onend: Handler = null;
        running = false;
        heard: { isFinal: boolean; 0: { transcript: string }; length: number }[] = [];
        constructor() {
          (window as unknown as { __speech: Fake }).__speech = this;
        }
        start() {
          this.running = true;
          setTimeout(() => this.onstart?.({}), 0);
        }
        stop() {
          this.running = false;
          this.onend?.({});
        }
        abort() {
          this.stop();
        }
        private push(text: string, isFinal: boolean) {
          const index = this.heard.length;
          this.heard.push({ isFinal, 0: { transcript: text }, length: 1 });
          this.onresult?.({ resultIndex: index, results: this.heard });
        }
        hearInterim(text: string) {
          this.push(text, false);
        }
        hearFinal(text: string) {
          this.push(text, true);
        }
        fail(error: string) {
          this.onerror?.({ error });
          this.running = false;
          this.onend?.({});
        }
      }
      (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = Fake;
    },
    { mode, noteSeen },
  );
}

async function hear(page: Page, kind: "hearInterim" | "hearFinal" | "fail", text: string) {
  await page.waitForFunction(
    () => (window as unknown as { __speech?: FakeSpeech }).__speech?.running === true,
  );
  await page.evaluate(
    ({ kind: method, text: value }) => {
      const speech = (window as unknown as { __speech: FakeSpeech }).__speech;
      speech[method](value);
    },
    { kind, text },
  );
}

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
      json: { public_id: `dodoi/local/posts/e2e-voice-${Date.now()}-${count}` },
    });
  });
}

function nextAction(page: Page, name: string) {
  return page.getByRole("button", { name, exact: true }).first();
}

test.beforeEach(() => {
  resetRateLimits();
});

test("E2E-37: dictating a comment types the words but does not post until Post is pressed", async ({
  page,
}) => {
  // Sign-in, the note, the dictation and an axe scan in one test: allow more than the default.
  test.setTimeout(60_000);
  await installSpeech(page, "fake", false);
  const post = createPost();
  await signIn(page);
  await page.goto(`/p/${post.id}`);
  await page.waitForLoadState("networkidle");

  const comments = page.getByRole("region", { name: /^Comments/ });
  const mic = comments
    .getByRole("button", { name: "Start voice typing" })
    .filter({ visible: true });

  // The first use explains where the audio goes; Cancel does nothing.
  await mic.first().click();
  const note = page.getByRole("dialog", { name: "Use your voice to type?" });
  await expect(note).toContainText("Google's speech service");
  await note.getByRole("button", { name: "Cancel" }).click();
  await expect(comments.getByRole("button", { name: "Stop voice typing" })).toHaveCount(0);

  await mic.first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Continue" }).click();
  const stop = comments
    .getByRole("button", { name: "Stop voice typing" })
    .filter({ visible: true });
  await expect(stop.first()).toHaveAttribute("aria-pressed", "true");
  await expect(comments.getByText("Listening…").first()).toBeVisible();

  await hear(page, "hearInterim", "such lovely");
  await expect(comments.getByText("such lovely").first()).toBeVisible();
  await hear(page, "hearFinal", "such lovely colours");

  const field = comments.getByLabel("Add a comment").filter({ visible: true }).first();
  await expect(field).toHaveValue("such lovely colours");
  await expect(comments.getByText("No comments yet. Be the first to say something.")).toBeVisible();

  // The page has no serious accessibility problem while listening.
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    results.violations.filter((v) => v.impact === "serious" || v.impact === "critical"),
  ).toEqual([]);

  await comments.getByRole("button", { name: "Post" }).click();
  await expect(comments.getByText("such lovely colours")).toBeVisible();
  await expect(comments.getByRole("heading", { name: "Comments (1)" })).toBeVisible();
});

test("a blocked microphone shows how to allow it and typing still works", async ({ page }) => {
  await installSpeech(page, "fake");
  const post = createPost();
  await signIn(page);
  await page.goto(`/p/${post.id}`);
  await page.waitForLoadState("networkidle");

  const comments = page.getByRole("region", { name: /^Comments/ });
  await comments
    .getByRole("button", { name: "Start voice typing" })
    .filter({ visible: true })
    .first()
    .click();
  await hear(page, "fail", "not-allowed");
  await expect(comments.getByText(/Microphone is blocked/).first()).toBeVisible();

  const field = comments.getByLabel("Add a comment").filter({ visible: true }).first();
  await field.fill("typing instead");
  await expect(field).toHaveValue("typing instead");
});

test("there is no mic button in a browser without speech recognition", async ({ page }) => {
  await installSpeech(page, "none");
  const post = createPost();
  await signIn(page);
  await page.goto(`/p/${post.id}`);
  await page.waitForLoadState("networkidle");

  const comments = page.getByRole("region", { name: /^Comments/ });
  await expect(
    comments.getByLabel("Add a comment").filter({ visible: true }).first(),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /voice typing/i })).toHaveCount(0);
});

test("create post: the story and a step can be dictated", async ({ page }) => {
  await installSpeech(page, "fake");
  await signIn(page);
  await answerUploads(page);

  await page.getByRole("link", { name: "Create" }).filter({ visible: true }).first().click();
  await expect(page.getByRole("heading", { name: "Add photos of what you made" })).toBeVisible();
  await page.locator("input[type=file][multiple]").setInputFiles([{ name: "a.jpg", ...PHOTO }]);
  await expect(page).toHaveURL(/\/create\/[a-z0-9]+$/);
  await nextAction(page, "Next").click();
  await page.getByLabel("Describe photo 1").fill("A small clay pot");
  await nextAction(page, "Next").click();

  const story = page.getByLabel("The story");
  await page.getByRole("button", { name: "Start voice typing" }).click();
  await hear(page, "hearFinal", "I rolled the clay by hand");
  await expect(story).toHaveValue("I rolled the clay by hand");
  await page.getByRole("button", { name: "Stop voice typing" }).click();
  // Nothing is shared by dictating.
  await expect(page).toHaveURL(/\/create\/[a-z0-9]+$/);

  // A tutorial's steps: say a step, then Add.
  await page.getByRole("button", { name: /^Type/ }).click();
  await page.getByRole("radio", { name: /Tutorial/ }).click();
  await page.getByRole("button", { name: "Done" }).click();
  await page.getByRole("button", { name: /^Materials and steps/ }).click();
  const sheet = page.getByRole("dialog", { name: "Materials and steps" });
  await sheet.getByRole("button", { name: "Start voice typing" }).click();
  await hear(page, "hearFinal", "Roll a ball of clay");
  await expect(sheet.getByLabel(/^Add step/)).toHaveValue("Roll a ball of clay");
  await sheet
    .getByLabel(/^Add step/)
    .locator("xpath=..")
    .getByRole("button", { name: "Add", exact: true })
    .click();
  await expect(sheet.getByText("Roll a ball of clay")).toBeVisible();
  await expect(sheet.getByLabel(/^Add step/)).toHaveValue("");
});
