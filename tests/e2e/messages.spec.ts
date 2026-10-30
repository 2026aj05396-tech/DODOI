import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";

import { createPasswordAccount, resetRateLimits } from "./helpers/accounts";

// Direct messages (roadmap P3-02, E2E-35; USER_FLOWS F-29): start from a profile → the other side
// sees it unread and answers → polling shows the answer → delete; "No one" hides Message; report and
// block; layout at the three widths.

const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 834, height: 1112 },
  desktop: { width: 1280, height: 860 },
} as const;

async function signIn(page: Page, email: string, password: string) {
  // Several workers sign in at once; clear the sign-in limiter so none is turned away.
  resetRateLimits();
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/feed$/);
  await page.waitForLoadState();
}

async function newPage(browser: Browser, baseURL: string | undefined): Promise<Page> {
  const context = await browser.newContext({ baseURL });
  return context.newPage();
}

/** The member's own profile address, e.g. `/u/e2e-1a2b3c4d`. */
async function profilePath(page: Page): Promise<string> {
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/u\/[^/]+$/);
  return new URL(page.url()).pathname;
}

async function send(page: Page, text: string) {
  await page.getByLabel(/^Message to /).fill(text);
  await page.getByRole("button", { name: "Send", exact: true }).click();
  // The field empties and the message joins the log once it is saved.
  await expect(page.getByLabel(/^Message to /)).toHaveValue("");
  await expect(page.getByRole("log", { name: "Messages" }).getByText(text)).toBeVisible();
}

async function openFromProfile(page: Page, path: string): Promise<string> {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /^Message @/ }).click();
  await expect(page).toHaveURL(/\/messages\/[^/]+$/);
  await page.waitForLoadState("networkidle");
  return new URL(page.url()).pathname;
}

test.beforeEach(() => {
  resetRateLimits();
});

test("E2E-35: message from a profile, the other side answers, polling shows it, a message is deleted", async ({
  browser,
  page,
  baseURL,
}) => {
  test.setTimeout(150_000);
  const asha = createPasswordAccount({ interests: ["watercolor"] });
  const ravi = createPasswordAccount({ interests: ["crochet"] });

  const raviPage = await newPage(browser, baseURL);
  await signIn(raviPage, ravi.email, ravi.password);
  const raviProfile = await profilePath(raviPage);

  await signIn(page, asha.email, asha.password);
  const conversation = await openFromProfile(page, raviProfile);
  await send(page, "Hello Ravi, loved your crochet post");

  // Ravi finds it unread in his list, opens it and answers.
  await raviPage.goto("/messages");
  await raviPage.waitForLoadState("networkidle");
  const row = raviPage.getByRole("link", { name: /Hello Ravi, loved your crochet post/ });
  await expect(row).toBeVisible();
  await expect(row.getByRole("img", { name: "Unread" })).toBeVisible();
  await row.click();
  await expect(raviPage).toHaveURL(conversation);
  await raviPage.waitForLoadState("networkidle");
  await send(raviPage, "Thank you! Happy to share the pattern.");

  // Asha's open conversation picks the answer up by polling (every 10 seconds).
  await expect(
    page.getByRole("log", { name: "Messages" }).getByText("Happy to share the pattern."),
  ).toBeVisible({ timeout: 25_000 });

  // Nobody sees read marks.
  await expect(page.getByText(/\bseen\b|\bread\b/i)).toHaveCount(0);

  // Asha deletes her first message; both sides read "Message deleted".
  await page.getByRole("button", { name: "More options for your message" }).first().click();
  await page.getByRole("menuitem", { name: "Delete message" }).click();
  await page.getByRole("button", { name: "Delete message", exact: true }).click();
  await expect(
    page.getByRole("log", { name: "Messages" }).getByText("Message deleted"),
  ).toBeVisible();
  await raviPage.reload();
  await expect(
    raviPage.getByRole("log", { name: "Messages" }).getByText("Message deleted"),
  ).toBeVisible();
});

test("E2E-35: 'No one' hides Message on a profile, and a block ends the conversation", async ({
  browser,
  page,
  baseURL,
}) => {
  test.setTimeout(150_000);
  const asha = createPasswordAccount({ interests: ["watercolor"] });
  const ravi = createPasswordAccount({ interests: ["crochet"] });

  const raviPage = await newPage(browser, baseURL);
  await signIn(raviPage, ravi.email, ravi.password);
  const raviProfile = await profilePath(raviPage);
  await signIn(page, asha.email, asha.password);

  // Message is offered at first.
  await page.goto(raviProfile);
  await expect(page.getByRole("button", { name: /^Message @/ })).toBeVisible();

  // Ravi picks "No one" in Settings → Messages; Message goes away for Asha.
  await raviPage.goto("/settings/messages");
  await raviPage.waitForLoadState("networkidle");
  await raviPage.getByRole("radio", { name: /No one/ }).check();
  await expect(
    raviPage.getByRole("region", { name: /Notifications/ }).getByText("Saved"),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Message @/ })).toHaveCount(0);

  // Back to Everyone: they talk, then Ravi blocks Asha and the conversation is gone for both.
  await raviPage.getByRole("radio", { name: /Everyone/ }).check();
  await expect(
    raviPage.getByRole("region", { name: /Notifications/ }).getByText("Saved"),
  ).toBeVisible();
  const conversation = await openFromProfile(page, raviProfile);
  await send(page, "Hi there");
  await raviPage.goto(conversation);
  await raviPage.waitForLoadState("networkidle");
  await raviPage.getByRole("button", { name: "More options for this conversation" }).click();
  await raviPage.getByRole("menuitem", { name: /^Block @/ }).click();
  await raviPage.getByRole("button", { name: "Block", exact: true }).click();
  // Blocking leaves the conversation (back to where Ravi came from).
  await expect(raviPage).not.toHaveURL(conversation);

  for (const who of [page, raviPage]) {
    await who.goto(conversation);
    await expect(who.getByRole("heading", { name: "We couldn't find that page" })).toBeVisible();
    await who.goto("/messages");
    await who.waitForLoadState("networkidle");
    await expect(who.getByText("Hi there")).toHaveCount(0);
  }
});

test("E2E-35: a reported message reaches a moderator with only that message and the ones before it", async ({
  browser,
  page,
  baseURL,
}) => {
  test.setTimeout(150_000);
  const asha = createPasswordAccount({ interests: ["watercolor"] });
  const ravi = createPasswordAccount({ interests: ["crochet"] });
  const moderator = createPasswordAccount({ moderator: true });

  const raviPage = await newPage(browser, baseURL);
  await signIn(raviPage, ravi.email, ravi.password);
  const raviProfile = await profilePath(raviPage);
  await signIn(page, asha.email, asha.password);
  const conversation = await openFromProfile(page, raviProfile);
  await send(page, "Opening line");
  await send(page, "Buy my course now");

  await raviPage.goto(conversation);
  await raviPage.waitForLoadState("networkidle");
  await raviPage.getByRole("button", { name: "More options for this message" }).last().click();
  await raviPage.getByRole("menuitem", { name: "Report message" }).click();
  await raviPage.getByRole("dialog").getByText("Spam or advertising").click();
  await raviPage.getByRole("button", { name: "Send report" }).click();
  await expect(raviPage.getByText("Thanks for letting us know")).toBeVisible();

  const modPage = await newPage(browser, baseURL);
  await signIn(modPage, moderator.email, moderator.password);
  await modPage.goto("/admin/reports");
  const group = modPage.getByRole("listitem").filter({ hasText: "Buy my course now" }).first();
  await expect(group.getByText("Message", { exact: true }).first()).toBeVisible();
  const thread = group.getByRole("list", { name: "The reported message and the ones before it" });
  await expect(thread.getByText("Opening line")).toBeVisible();
  await expect(thread.getByText("Reported ·")).toBeVisible();
  // A private message can only be dismissed, never hidden.
  await expect(group.getByRole("button", { name: /^Hide/ })).toHaveCount(0);
  await group.getByRole("button", { name: "Dismiss" }).click();
  await expect(group).toHaveCount(0);
});

test("E2E-35: the message screens fit 390, 834 and 1280px with no serious accessibility issues", async ({
  browser,
  page,
  baseURL,
}) => {
  test.setTimeout(150_000);
  const asha = createPasswordAccount({ interests: ["watercolor"] });
  const ravi = createPasswordAccount({ interests: ["crochet"] });
  const raviPage = await newPage(browser, baseURL);
  await signIn(raviPage, ravi.email, ravi.password);
  const raviProfile = await profilePath(raviPage);
  await signIn(page, asha.email, asha.password);
  const conversation = await openFromProfile(page, raviProfile);
  await send(page, "Layout check");

  for (const viewport of Object.values(VIEWPORTS)) {
    await page.setViewportSize(viewport);
    for (const path of ["/messages", conversation, "/settings/messages"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${path} at ${viewport.width}px scrolls sideways`).toBeLessThanOrEqual(0);
      const results = await new AxeBuilder({ page }).analyze();
      expect(
        results.violations.filter((v) => v.impact === "serious" || v.impact === "critical"),
      ).toEqual([]);
    }
  }
});

test("E2E-35: New message finds a member who can be messaged, hides one who cannot, and opens the chat", async ({
  browser,
  page,
  baseURL,
}) => {
  test.setTimeout(150_000);
  const asha = createPasswordAccount({ interests: ["watercolor"] });
  const ravi = createPasswordAccount({ interests: ["crochet"] });
  const meera = createPasswordAccount({ interests: ["crochet"] });

  const raviPage = await newPage(browser, baseURL);
  await signIn(raviPage, ravi.email, ravi.password);
  const raviUsername = (await profilePath(raviPage)).split("/").pop() ?? "";
  const meeraPage = await newPage(browser, baseURL);
  await signIn(meeraPage, meera.email, meera.password);
  const meeraUsername = (await profilePath(meeraPage)).split("/").pop() ?? "";
  // Meera closes messages: she must not appear for Asha.
  await meeraPage.goto("/settings/messages");
  await meeraPage.waitForLoadState("networkidle");
  await meeraPage.getByRole("radio", { name: /No one/ }).check();
  await expect(
    meeraPage.getByRole("region", { name: /Notifications/ }).getByText("Saved"),
  ).toBeVisible();

  await signIn(page, asha.email, asha.password);

  for (const viewport of [VIEWPORTS.mobile, VIEWPORTS.desktop]) {
    await page.setViewportSize(viewport);
    await page.goto("/messages");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "New message" }).click();
    const panel = page.getByRole("dialog", { name: "New message" });
    await expect(panel).toBeVisible();

    const field = panel.getByLabel("Search people");
    await field.fill(meeraUsername);
    await expect(panel.getByText("No one found that you can message")).toBeVisible();

    await field.fill(raviUsername);
    await expect(panel.getByRole("button", { name: new RegExp(`@${raviUsername}`) })).toBeVisible();
    const results = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
    expect(
      results.violations.filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);

    await panel.getByLabel("Close").click();
    await expect(panel).toHaveCount(0);
  }

  // Picking the member opens a conversation and Asha can write in it.
  await page.getByRole("button", { name: "New message" }).click();
  const panel = page.getByRole("dialog", { name: "New message" });
  await panel.getByLabel("Search people").fill(raviUsername);
  await panel.getByRole("button", { name: new RegExp(`@${raviUsername}`) }).click();
  await expect(page).toHaveURL(/\/messages\/[^/]+$/);
  await page.waitForLoadState("networkidle");
  await send(page, "Found you through New message");
});
