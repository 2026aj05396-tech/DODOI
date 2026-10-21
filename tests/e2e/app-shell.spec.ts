import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

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
    await expect(nav.getByRole("button", { name: /Messages\s*, coming soon/ })).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Suggestions" })).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });
});

test("coming-soon items show a tooltip and make no network requests", async ({ page }) => {
  await page.goto("/shell-preview");
  await page.waitForLoadState("networkidle");
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));

  // aria-disabled controls stay tappable for real users; Playwright needs `force` to click them.
  await page
    .getByRole("button", { name: /Create\s*, coming soon/ })
    .filter({ visible: true })
    .click({ force: true });

  await expect(page.getByRole("tooltip")).toHaveText("Coming soon");
  await expect(page).toHaveURL(/\/shell-preview$/);
  expect(requests).toEqual([]);
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
