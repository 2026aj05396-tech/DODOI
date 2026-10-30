import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";

import { createPasswordAccount, resetRateLimits } from "./helpers/accounts";

// Creative sessions (roadmap P3-04, E2E-36; USER_FLOWS F-30): propose from a profile → the other
// person accepts and both see the link with its warning, or suggests another time, or cancels; times
// shown in the viewer's zone with IST beside; layout at the three widths.

const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 834, height: 1112 },
  desktop: { width: 1280, height: 860 },
} as const;
const LINK = "https://meet.google.com/e2e-test-room";

async function signIn(page: Page, email: string, password: string) {
  // Several workers sign in at once; clear the sign-in limiter so none is turned away.
  resetRateLimits();
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/feed$/);
  await page.waitForLoadState();
}

async function newPage(
  browser: Browser,
  baseURL: string | undefined,
  options: { timezoneId?: string } = {},
): Promise<Page> {
  const context = await browser.newContext({ baseURL, ...options });
  return context.newPage();
}

async function profilePath(page: Page): Promise<string> {
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/u\/[^/]+$/);
  return new URL(page.url()).pathname;
}

/** A date two days ahead as `YYYY-MM-DD`, read in the page's own time zone. */
async function inTwoDays(page: Page, extraDays = 2): Promise<string> {
  return page.evaluate((days) => {
    const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
  }, extraDays);
}

async function propose(page: Page, profile: string, note = "Bring your hoop") {
  await page.goto(profile);
  await page.waitForLoadState("networkidle");
  await page.getByRole("link", { name: /^Propose a session to @/ }).click();
  await expect(page).toHaveURL(/\/community\/sessions\/new\?with=/);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Date").fill(await inTwoDays(page));
  await page.getByLabel("Time").fill("16:00");
  await page.getByLabel("Length").selectOption("45");
  await page.getByLabel("Meeting link").fill(LINK);
  await page.getByLabel("Note (optional)").fill(note);
  await page.getByRole("button", { name: "Send proposal" }).click();
  await expect(page).toHaveURL(/\/community\/sessions$/);
}

test.beforeEach(() => {
  resetRateLimits();
});

test("E2E-36: propose a session, the other person accepts, both see the link with its warning, then it is cancelled", async ({
  browser,
  page,
  baseURL,
}) => {
  test.setTimeout(150_000);
  const asha = createPasswordAccount({ interests: ["watercolor"] });
  const ravi = createPasswordAccount({ interests: ["crochet"] });
  const raviPage = await newPage(browser, baseURL);
  await signIn(raviPage, ravi.email, ravi.password);
  const raviProfile = await profilePath(raviPage);

  await signIn(page, asha.email, asha.password);
  await propose(page, raviProfile);
  // Asha waits, and the link stays hidden until it is accepted.
  await page.waitForLoadState("networkidle");
  await expect(page.getByText(/Waiting for .* to answer\./)).toBeVisible();
  await expect(page.getByRole("article").getByText(/45 min/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Join the call/ })).toHaveCount(0);

  // Ravi is told, sees the proposal without the link, and accepts.
  await raviPage.goto("/notifications");
  await expect(raviPage.getByText(/proposed a session on/)).toBeVisible();
  await raviPage.goto("/community/sessions");
  await raviPage.waitForLoadState("networkidle");
  await expect(raviPage.getByText("Proposed to you")).toBeVisible();
  await expect(raviPage.getByText("Bring your hoop")).toBeVisible();
  await expect(raviPage.getByRole("link", { name: /Join the call/ })).toHaveCount(0);
  await raviPage.getByRole("button", { name: "Accept" }).click();
  const link = raviPage.getByRole("link", { name: /Join the call/ });
  await expect(link).toHaveAttribute("href", LINK);
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  await expect(
    raviPage.getByText("Opens another site. Only join if you're comfortable."),
  ).toBeVisible();

  // Asha is told and now sees the link too.
  await page.goto("/notifications");
  await expect(page.getByText(/accepted your session on/)).toBeVisible();
  await page.goto("/community/sessions");
  await expect(page.getByRole("link", { name: /Join the call/ })).toHaveAttribute("href", LINK);

  // Either side can cancel; the link goes and the session moves to Past.
  await raviPage.getByRole("button", { name: "Cancel session" }).click();
  await raviPage.getByRole("button", { name: "Cancel session" }).last().click();
  await expect(raviPage.getByText("No sessions coming up")).toBeVisible();
  await raviPage.getByRole("button", { name: "Past" }).click();
  await expect(raviPage.getByText("Cancelled", { exact: true })).toBeVisible();
  await expect(raviPage.getByRole("link", { name: /Join the call/ })).toHaveCount(0);
  await page.goto("/notifications");
  await expect(page.getByText(/cancelled the session on/)).toBeVisible();
});

test("E2E-36: the invitee suggests another time and the first person answers it", async ({
  browser,
  page,
  baseURL,
}) => {
  test.setTimeout(150_000);
  const asha = createPasswordAccount({ interests: ["watercolor"] });
  const ravi = createPasswordAccount({ interests: ["crochet"] });
  const raviPage = await newPage(browser, baseURL);
  await signIn(raviPage, ravi.email, ravi.password);
  const raviProfile = await profilePath(raviPage);
  await signIn(page, asha.email, asha.password);
  await propose(page, raviProfile, "Hoop tips");

  await raviPage.goto("/community/sessions");
  await raviPage.waitForLoadState("networkidle");
  await raviPage.getByRole("button", { name: "Suggest another time" }).click();
  const dialog = raviPage.getByRole("dialog", { name: "Suggest another time" });
  await dialog.getByLabel("Date").fill(await inTwoDays(raviPage, 4));
  await dialog.getByLabel("Time").fill("11:30");
  await dialog.getByRole("button", { name: "Send new time" }).click();
  await expect(raviPage.getByText("Waiting for ")).toBeVisible();

  // Asha is told, the old proposal is in Past, and the new one needs her answer.
  await page.goto("/notifications");
  await expect(page.getByText(/suggested a new time for your session/)).toBeVisible();
  await page.goto("/community/sessions");
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Proposed to you")).toBeVisible();
  await page.getByRole("button", { name: "Past" }).click();
  await expect(page.getByText("New time suggested")).toBeVisible();
  await page.getByRole("button", { name: "Upcoming" }).click();
  await page.getByRole("button", { name: "Decline" }).click();
  await expect(page.getByText("No sessions coming up")).toBeVisible();
});

test("E2E-36: a viewer outside India sees the time in their own zone with IST beside it", async ({
  browser,
  page,
  baseURL,
}) => {
  test.setTimeout(150_000);
  const asha = createPasswordAccount({ interests: ["watercolor"] });
  const ravi = createPasswordAccount({ interests: ["crochet"] });
  const raviPage = await newPage(browser, baseURL, { timezoneId: "Europe/London" });
  await signIn(raviPage, ravi.email, ravi.password);
  const raviProfile = await profilePath(raviPage);
  await signIn(page, asha.email, asha.password);
  await propose(page, raviProfile);

  await raviPage.goto("/community/sessions");
  await raviPage.waitForLoadState("networkidle");
  // The text reads like "Fri, 6 Nov, 11:30 am · Fri, 6 Nov, 5:00 pm IST".
  await expect(raviPage.getByRole("article").getByText(/IST/)).toBeVisible();
  // The proposer (in the test browser's own zone) sees the same moment in hers.
  await expect(page.getByRole("article").locator("time")).toBeVisible();
});

test("E2E-36: the session screens fit 390, 834 and 1280px with no serious accessibility issues", async ({
  browser,
  page,
  baseURL,
}) => {
  test.setTimeout(150_000);
  const asha = createPasswordAccount({ interests: ["watercolor"] });
  const ravi = createPasswordAccount({ interests: ["crochet"] });
  const raviPage = await newPage(browser, baseURL);
  await signIn(raviPage, ravi.email, ravi.password);
  const raviProfile = await profilePath(raviPage);
  await signIn(page, asha.email, asha.password);
  await propose(page, raviProfile);
  const username = raviProfile.split("/").at(-1) ?? "";

  for (const viewport of Object.values(VIEWPORTS)) {
    await page.setViewportSize(viewport);
    for (const path of ["/community/sessions", `/community/sessions/new?with=${username}`]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${path} at ${viewport.width}px scrolls sideways`).toBeLessThanOrEqual(0);
      const results = await new AxeBuilder({ page }).analyze();
      expect(
        results.violations.filter((v) => v.impact === "serious" || v.impact === "critical"),
      ).toEqual([]);
    }
  }
});
