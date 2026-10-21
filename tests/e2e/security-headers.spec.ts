import { expect, test } from "@playwright/test";

// The E2E server runs with APP_ENV=local, so HSTS is off and noindex is on.
test("pages are served with the security headers", async ({ request }) => {
  const response = await request.get("/");
  const headers = response.headers();

  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["permissions-policy"]).toContain("camera=()");
  expect(headers["x-robots-tag"]).toBe("noindex, nofollow");
  expect(headers["strict-transport-security"]).toBeUndefined();
  expect(headers["x-powered-by"]).toBeUndefined();
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
});

for (const path of ["/", "/dev/ui"]) {
  test(`${path} renders and hydrates without CSP violations`, async ({ page }) => {
    const violations: string[] = [];
    page.on("console", (message) => {
      if (message.text().includes("Content Security Policy")) violations.push(message.text());
    });

    await page.goto(path);
    await page.waitForLoadState("networkidle");

    expect(violations).toEqual([]);
  });
}

test("client-side interactivity still works under the CSP", async ({ page }) => {
  await page.goto("/dev/ui");

  const chip = page.getByRole("button", { name: "Watercolor" });
  await chip.click();

  await expect(chip).toHaveAttribute("aria-pressed", "true");
});
