import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("welcome page renders and has no serious accessibility violations", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { level: 1, name: /For the things you love making/ }),
  ).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(blocking).toEqual([]);
});

test("the welcome page shows design 1a on mobile and the 2a landing on desktop", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");

  const joinFree = page.getByRole("link", { name: "Join free" });
  if (isMobile) {
    await expect(joinFree).toBeHidden();
    await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();
  } else {
    await expect(joinFree).toBeVisible();
    await expect(page.getByText("A creative space for curious makers")).toBeVisible();
  }
});
