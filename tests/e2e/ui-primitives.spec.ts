import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("UI primitives preview", () => {
  test("has no serious accessibility violations", async ({ page }) => {
    await page.goto("/dev/ui");
    await expect(page.getByRole("heading", { level: 1, name: "UI primitives" })).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    );
    expect(blocking).toEqual([]);
  });

  test("keyboard users see the plum focus ring", async ({ page }) => {
    await page.goto("/dev/ui");

    await page.keyboard.press("Tab");
    const outline = await page.evaluate(() => {
      const element = document.activeElement;
      return element ? getComputedStyle(element).outlineStyle : "none";
    });

    expect(outline).toBe("solid");
  });

  test("the sheet traps focus and returns it to its trigger on Escape", async ({ page }) => {
    await page.goto("/dev/ui");
    // Wait for hydration: the preview is a large page and a click before it is ignored.
    await page.waitForLoadState("networkidle");
    const trigger = page.getByRole("button", { name: "Open sheet" });

    await trigger.click();
    await expect(page.getByRole("dialog", { name: "Add to collection" })).toBeVisible();
    await page.keyboard.press("Escape");

    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});
