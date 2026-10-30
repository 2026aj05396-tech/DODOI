import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { createPasswordAccount, createPost, resetRateLimits } from "./helpers/accounts";

const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 834, height: 1112 },
  desktop: { width: 1280, height: 860 },
} as const;

async function expectNoSeriousA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(blocking).toEqual([]);
}

// Layout checks set their own viewport, so they only need to run in one Playwright project.
test.describe("app shell layout", () => {
  test.skip(({ isMobile }) => isMobile, "viewport-specific checks run once in the desktop project");

  test("mobile: header and bottom tabs, no sidebar or rail", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto("/shell-preview");

    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav).toHaveCount(1);
    await expect(nav.getByRole("link", { name: "Explore" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Saved" })).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Suggestions" })).toBeHidden();
    await expectNoSeriousA11yViolations(page);
  });

  test("tablet: icon rail only, no right rail", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.tablet);
    await page.goto("/shell-preview");

    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav).toHaveCount(1);
    await expect(nav.getByRole("link", { name: "dodoi" })).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Suggestions" })).toBeHidden();
    await expectNoSeriousA11yViolations(page);
  });

  test("desktop: full sidebar and right rail", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto("/shell-preview");

    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav).toHaveCount(1);
    await expect(nav.getByRole("link", { name: "Messages" })).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Suggestions" })).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });
});

test("E2E-16: coming-soon items show a tooltip and make no network requests", async ({
  page,
  isMobile,
}) => {
  // Phones show no coming-soon item any more: the post page hides this button there.
  test.skip(isMobile, "No coming-soon item is reachable on phones since P3-04.");
  // With every Community tab live (P3-04), "Start as my project" on a post that is not a tutorial
  // is the coming-soon item left to check (it is behind sign-in).
  resetRateLimits();
  const { email, password } = createPasswordAccount();
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/feed$/);
  const { relatedId } = createPost();
  await page.goto(`/p/${relatedId}`);
  // The service worker registers after load and precaches the app (P1-27); let it finish first.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForLoadState("networkidle");
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));

  // aria-disabled controls stay tappable for real users; Playwright needs `force` to click them.
  await page
    .getByRole("button", { name: /Start as my project\s*, coming soon/ })
    .filter({ visible: true })
    .click({ force: true });

  await expect(page.getByRole("tooltip")).toHaveText("Coming soon");
  await expect(page).toHaveURL(new RegExp(`/p/${relatedId}$`));
  // The unread dots poll on their own schedule (bell and Messages); only the click must be silent.
  expect(
    requests.filter((url) => !/\/api\/(conversations|notifications\/unread)/.test(url)),
  ).toEqual([]);
});

test("keyboard users can skip straight to the content", async ({ page }) => {
  await page.goto("/shell-preview");

  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Skip to content" });
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page.locator("#main-content")).toBeFocused();
});

test("unknown pages show the friendly not-found page with a 404", async ({ page }) => {
  const response = await page.goto("/this-page-does-not-exist");

  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "We couldn't find that page" })).toBeVisible();
});
