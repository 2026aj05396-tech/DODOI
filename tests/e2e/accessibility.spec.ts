import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { createPasswordAccount, createPost, resetRateLimits } from "./helpers/accounts";

// Accessibility pass (P1-31, WCAG 2.2 AA): axe on every Phase 1 screen at the three review widths
// (UI_UX_GUIDELINES §8), and a keyboard sweep of the main screens. Serious and critical violations
// fail; all are listed together so one run shows everything to fix. Runs once (desktop project)
// and sets each width itself.

const MOBILE = { width: 390, height: 844 };
const TABLET = { width: 834, height: 1112 };
const DESKTOP = { width: 1280, height: 860 };
const WIDTHS = [MOBILE, TABLET, DESKTOP];
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

type Screen = { name: string; path: string };

test.skip(({ isMobile }) => isMobile, "Sets each review width itself; runs once.");
test.describe.configure({ timeout: 300_000 });

test.beforeEach(() => {
  resetRateLimits();
});

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => url.pathname !== "/sign-in");
}

/** Runs axe on each screen at each width; returns one line per serious/critical violation. */
async function audit(page: Page, screens: Screen[]): Promise<string[]> {
  const problems: string[] = [];
  for (const screen of screens) {
    for (const size of WIDTHS) {
      await page.setViewportSize(size);
      await page.goto(screen.path);
      await page.waitForLoadState("networkidle");
      const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
      for (const violation of results.violations) {
        if (violation.impact !== "serious" && violation.impact !== "critical") continue;
        const targets = violation.nodes.map((node) => node.target.join(" ")).slice(0, 3);
        problems.push(
          `${screen.name} @${size.width}: ${violation.id} (${violation.impact}) → ${targets.join(" | ")}`,
        );
      }
    }
  }
  return problems;
}

test("signed-out screens", async ({ page }) => {
  const post = createPost();

  const problems = await audit(page, [
    { name: "welcome", path: "/" },
    { name: "sign in", path: "/sign-in" },
    { name: "sign up", path: "/sign-up" },
    { name: "forgot password", path: "/forgot-password" },
    { name: "reset password", path: "/reset-password?token=expired" },
    { name: "post (signed out)", path: `/p/${post.id}` },
  ]);

  expect(problems).toEqual([]);
});

test("onboarding", async ({ page }) => {
  const { email, password } = createPasswordAccount({ onboardingIncomplete: true });
  await signIn(page, email, password);

  expect(await audit(page, [{ name: "onboarding", path: "/onboarding" }])).toEqual([]);
});

test("signed-in screens", async ({ page }) => {
  const post = createPost();
  const { email, password } = createPasswordAccount({
    interests: ["crochet", "knitting", "sewing"],
  });
  await signIn(page, email, password);
  const collection = await page.request.post("/api/collections", {
    data: { name: "Weekend ideas" },
  });
  const { id: collectionId } = (await collection.json()) as { id: string };

  const problems = await audit(page, [
    { name: "feed", path: "/feed" },
    { name: "explore", path: "/explore" },
    { name: "all skills", path: "/explore/skills" },
    { name: "search", path: "/search?q=crochet" },
    { name: "search, no results", path: "/search?q=zzzzqqqq" },
    { name: "skill", path: "/s/crochet" },
    { name: "post", path: `/p/${post.id}` },
    { name: "saved", path: "/saved" },
    { name: "collection", path: `/saved/${collectionId}` },
    { name: "profile", path: "/profile" },
    { name: "settings", path: "/settings" },
    { name: "edit profile", path: "/settings/profile" },
    { name: "your skills", path: "/settings/skills" },
    { name: "privacy", path: "/settings/privacy" },
    { name: "account", path: "/settings/account" },
    { name: "delete account", path: "/settings/account/delete" },
    { name: "create post", path: "/create" },
    { name: "journal", path: "/journal" },
  ]);

  expect(problems).toEqual([]);
});

test("admin screens and a theme page", async ({ page }) => {
  const post = createPost();
  const { email, password } = createPasswordAccount({ admin: true });
  await signIn(page, email, password);
  const slug = `a11y-${Date.now()}`;
  const theme = await page.request.post("/api/admin/themes", {
    data: { slug, title: "Rainy day makes", isPublished: true, postIds: [post.id] },
  });
  expect(theme.status()).toBe(201);
  const { id: themeId } = (await theme.json()) as { id: string };
  await page.goto("/admin/skills");
  const skillHref = await page.locator('a[href^="/admin/skills/"]').first().getAttribute("href");

  const problems = await audit(page, [
    { name: "admin posts", path: "/admin/posts" },
    { name: "admin new post", path: "/admin/posts/new" },
    { name: "admin edit post", path: `/admin/posts/${post.id}` },
    { name: "admin skills", path: "/admin/skills" },
    { name: "admin edit skill", path: skillHref ?? "/admin/skills" },
    { name: "admin themes", path: "/admin/themes" },
    { name: "admin edit theme", path: `/admin/themes/${themeId}` },
    { name: "admin reports", path: "/admin/reports" },
    { name: "theme", path: `/t/${slug}` },
  ]);

  expect(problems).toEqual([]);
});

/**
 * Tabs through the first `presses` stops of the page: each focused element must be visible on
 * screen and show the focus ring (WCAG 2.4.7, 2.4.11). Returns one line per problem.
 */
async function sweepFocus(page: Page, name: string, presses = 30): Promise<string[]> {
  const problems: string[] = [];
  await page.locator("body").click({ position: { x: 1, y: 1 } });
  for (let stop = 1; stop <= presses; stop += 1) {
    await page.keyboard.press("Tab");
    const focus = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      if (!element || element === document.body) return null;
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        label: `${element.tagName.toLowerCase()} "${(element.getAttribute("aria-label") ?? element.textContent ?? "").trim().slice(0, 40)}"`,
        visible: box.width > 0 && box.height > 0 && style.visibility !== "hidden",
        onScreen: box.bottom > 0 && box.right > 0 && box.left < window.innerWidth,
        // Some controls draw the ring on their wrapper (e.g. SearchField's pill).
        ring: [element, element.parentElement, element.parentElement?.parentElement].some(
          (node) => {
            if (!node) return false;
            const nodeStyle = getComputedStyle(node);
            return nodeStyle.outlineStyle !== "none" && parseFloat(nodeStyle.outlineWidth) >= 2;
          },
        ),
      };
    });
    if (!focus) continue;
    if (!focus.visible || !focus.onScreen)
      problems.push(`${name} #${stop}: hidden focus on ${focus.label}`);
    else if (!focus.ring) problems.push(`${name} #${stop}: no focus ring on ${focus.label}`);
  }
  return problems;
}

test("keyboard focus is always visible on the main screens", async ({ page }) => {
  const post = createPost();
  const { email, password } = createPasswordAccount({
    interests: ["crochet", "knitting", "sewing"],
  });
  await signIn(page, email, password);

  const problems: string[] = [];
  for (const size of [MOBILE, DESKTOP]) {
    await page.setViewportSize(size);
    for (const { name, path } of [
      { name: "feed", path: "/feed" },
      { name: "explore", path: "/explore" },
      { name: "post", path: `/p/${post.id}` },
      { name: "saved", path: "/saved" },
      { name: "settings", path: "/settings/account" },
    ]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      problems.push(...(await sweepFocus(page, `${name} @${size.width}`)));
    }
  }

  expect(problems).toEqual([]);
});
