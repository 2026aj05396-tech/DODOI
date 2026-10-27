import { expect, test, type Page } from "@playwright/test";

import { createFeedPosts, createPasswordAccount, resetRateLimits } from "./helpers/accounts";

// PWA offline behaviour (P1-27, E2E-13; offline matrix in SYSTEM_ARCHITECTURE §9).

// Chromium runs it once (desktop); the WebKit and Firefox smoke runs check it in their engines.
test.skip(
  ({ isMobile, browserName }) => isMobile && browserName === "chromium",
  "Service worker behaviour is the same on every width.",
);
// Checked 2026-10-27: in Firefox, Playwright's offline switch doesn't reach the service worker,
// which keeps fetching from the network, so offline can't be tested there.
test.skip(
  ({ browserName }) => browserName === "firefox",
  "Playwright can't take Firefox's service worker offline.",
);
// Installing precaches the whole app, which takes a while when every test runs at once.
test.describe.configure({ timeout: 90_000 });

test.beforeEach(() => {
  resetRateLimits();
});

const OFFLINE_BANNER = "You're offline. Some things won't work until you reconnect.";

async function signIn(page: Page, interests: string[]) {
  const { email, password } = createPasswordAccount({ interests });
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/feed$/);
}

/**
 * Waits for the service worker to be active, then reloads: a page loaded after that is always
 * controlled by it, so its caching applies to what follows (and the feed is kept for offline).
 */
async function loadUnderServiceWorker(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
}

test(
  "E2E-13: a visited feed opens offline; other pages show the offline page",
  { tag: "@smoke" },
  async ({ page, context }) => {
    const craft = createFeedPosts(2);
    await signIn(page, [craft.skillSlug]);
    await loadUnderServiceWorker(page);
    const feed = page.getByRole("region", { name: "Your feed" });
    await expect(feed.getByRole("article").first()).toBeVisible();

    await context.setOffline(true);
    await expect(page.getByRole("status").getByText(OFFLINE_BANNER)).toBeVisible();

    // Saving isn't queued offline: the button stays reachable and says why.
    const save = feed
      .getByRole("button", { name: /^Save / })
      .filter({ visible: true })
      .first();
    await expect(save).toHaveAttribute("aria-disabled", "true");
    await save.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByText("You're offline. Saving needs a connection.", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("searchbox")).toBeDisabled();

    // The feed comes from the cache; a page never opened shows the offline page.
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: /What will you make/ })).toBeVisible();
    await expect(feed.getByRole("article").first()).toBeVisible();
    await page.goto("/settings/privacy");
    await expect(page.getByRole("heading", { level: 1, name: "You're offline" })).toBeVisible();

    await context.setOffline(false);
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Privacy" })).toBeVisible();
  },
);

test("signing out deletes the pages kept for offline use", async ({ page }) => {
  const craft = createFeedPosts(1);
  await signIn(page, [craft.skillSlug]);
  await loadUnderServiceWorker(page);
  await expect
    .poll(() => page.evaluate(async () => (await caches.keys()).includes("dodoi-pages")))
    .toBe(true);

  await page.goto("/settings/account");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);

  expect(await page.evaluate(async () => (await caches.keys()).includes("dodoi-pages"))).toBe(
    false,
  );
});
