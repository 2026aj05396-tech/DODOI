import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test(
  "welcome page renders and has no serious accessibility violations",
  { tag: "@smoke" },
  async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { level: 1, name: /For the things you love making/ }),
    ).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    );
    expect(blocking).toEqual([]);
  },
);

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

test("the welcome page has no serious accessibility violations on tablet", async ({ page }) => {
  await page.setViewportSize({ width: 834, height: 1112 });
  await page.goto("/");

  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(blocking).toEqual([]);
});

// P1-30: what a link preview shows when the landing page is shared.
test("the welcome page has share metadata with a working image", async ({ page, request }) => {
  await page.goto("/");

  const meta = (key: string) =>
    page.locator(`meta[property="${key}"], meta[name="${key}"]`).first().getAttribute("content");
  expect(await meta("og:title")).toBe("dodoi · For the things you love making");
  expect(await meta("og:site_name")).toBe("dodoi");
  expect(await meta("og:url")).toMatch(/^http:\/\/localhost:\d+\/?$/);
  expect(await meta("twitter:card")).toBe("summary_large_image");
  expect(await meta("og:image:alt")).toMatch(/^dodoi: for the things you love making/);

  const image = new URL((await meta("og:image")) ?? "");
  const response = await request.get(`${image.pathname}${image.search}`);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("image/png");

  // Local runs are never indexed; production allows only the landing page and posts.
  expect(await (await request.get("/robots.txt")).text()).toContain("Disallow: /");
});

// P1-27: the manifest and every icon it names are served, and the page links to them.
test("the app can be installed: manifest, icons and Apple touch icon", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/manifest.webmanifest",
  );
  const appleIcon = await page.locator('link[rel="apple-touch-icon"]').getAttribute("href");

  const manifest = (await (await request.get("/manifest.webmanifest")).json()) as {
    start_url: string;
    display: string;
    icons: { src: string; sizes: string; purpose: string }[];
  };
  expect(manifest).toMatchObject({ start_url: "/", display: "standalone" });
  expect(manifest.icons.map((icon) => `${icon.sizes} ${icon.purpose}`)).toEqual([
    "192x192 any",
    "512x512 any",
    "512x512 maskable",
  ]);

  for (const src of [...manifest.icons.map((icon) => icon.src), appleIcon ?? "", "/favicon.ico"]) {
    const response = await request.get(src);
    expect(response.status(), src).toBe(200);
    expect(response.headers()["content-type"], src).toMatch(/^image\//);
  }
});

test("Discover in the desktop header leads to Explore after signing in", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "The product areas are in the desktop header only.");
  await page.goto("/");

  await page
    .getByRole("list", { name: "What you can do on dodoi" })
    .getByRole("link", { name: "Discover" })
    .click();

  await expect(page).toHaveURL(/\/sign-in\?returnTo=%2Fexplore$/);
});
