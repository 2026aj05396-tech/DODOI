import { expect, test } from "@playwright/test";

// A form submitted before the page's JavaScript has loaded is sent by the browser itself. Every
// form declares method="post", so that never puts passwords or a date of birth in the URL, history
// or server logs (SECURITY_AND_PRIVACY §4). The app's JavaScript files are blocked to be that
// early submit; the page's own inline scripts still run, so streamed content shows as usual.

test.skip(({ isMobile }) => isMobile, "Same forms on every width.");

for (const path of ["/sign-in", "/sign-up", "/forgot-password", "/reset-password?token=expired"]) {
  test(`${path}: an early submit keeps the fields out of the URL`, async ({ page }) => {
    await page.route("**/_next/static/chunks/**/*.js", (route) => route.abort());
    await page.goto(path);
    const form = page.locator("form").first();
    await expect(form).toHaveAttribute("method", "post");

    for (const field of await form.locator("input[name]").all()) {
      const type = await field.getAttribute("type");
      if (type === "checkbox" || type === "hidden") continue;
      const value =
        type === "email" ? "someone@example.test" : type === "date" ? "1995-08-15" : "secret 123";
      await field.fill(value);
    }
    await form.locator('button[type="submit"]').first().click();
    await page.waitForLoadState();

    expect(page.url()).not.toMatch(/secret|someone|1995|password=|email=|dateOfBirth=/);
  });
}
