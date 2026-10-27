import { devices, expect, test, type Page } from "@playwright/test";

import { createFeedPosts, createPasswordAccount, resetRateLimits } from "./helpers/accounts";

// Install guidance (P1-27, USER_FLOWS F-12): offered after the first save or on the second visit,
// hidden for 30 days once dismissed. Headless Chromium never fires `beforeinstallprompt`, so the
// test fires one shaped like Chromium's. Runs once (desktop project).

test.skip(({ isMobile }) => isMobile, "Sets its own browsers; runs once.");

test.beforeEach(() => {
  resetRateLimits();
});

async function signIn(page: Page, interests: string[]) {
  const { email, password } = createPasswordAccount({ interests });
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/feed$/);
}

/** What Chromium fires when the app can be installed. */
async function fireInstallPrompt(page: Page) {
  await page.evaluate(() => {
    const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
      prompt: async () => undefined,
      userChoice: Promise.resolve({ outcome: "dismissed" }),
    });
    window.dispatchEvent(event);
  });
}

const banner = (page: Page) => page.getByRole("complementary", { name: "Install dodoi" });

test("Chromium: offered after the first save, and gone once dismissed", async ({ page }) => {
  const craft = createFeedPosts(1);
  await signIn(page, [craft.skillSlug]);
  const feed = page.getByRole("region", { name: "Your feed" });
  await expect(feed.getByRole("article").first()).toBeVisible();
  await fireInstallPrompt(page);

  // First visit, nothing saved yet: not offered.
  await expect(banner(page)).toHaveCount(0);

  const saved = page.waitForResponse(
    (response) => response.url().includes("/api/saves/") && response.ok(),
  );
  await feed
    .getByRole("button", { name: /^Save / })
    .filter({ visible: true })
    .first()
    .click();
  await saved;
  await expect(banner(page).getByRole("button", { name: "Install app" })).toBeVisible();

  await banner(page).getByRole("button", { name: "Not now" }).click();
  await expect(banner(page)).toHaveCount(0);
  await page.reload();
  await fireInstallPrompt(page);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(banner(page)).toHaveCount(0);
});

test("iPhone Safari: the Add to Home Screen steps on the second visit", async ({
  browser,
  baseURL,
}) => {
  // Safari's identity on Chromium: the banner goes by the browser it is told it's in.
  const { defaultBrowserType: _, ...iPhone } = devices["iPhone 15"];
  const context = await browser.newContext({ ...iPhone, baseURL });
  const page = await context.newPage();
  const craft = createFeedPosts(1);
  await signIn(page, [craft.skillSlug]);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(banner(page)).toHaveCount(0);

  // A new tab is a new browser session: the second visit.
  const second = await context.newPage();
  await second.goto("/feed");
  await second.getByRole("button", { name: "How to install" }).click();
  const steps = second.getByRole("dialog", { name: "Add dodoi to your home screen" });
  await expect(steps.getByText("Add to Home Screen")).toBeVisible();
  await context.close();
});
