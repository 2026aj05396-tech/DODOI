import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";

import { createPasswordAccount, resetRateLimits } from "./helpers/accounts";

// Communities (roadmap P3-01, E2E-34; USER_FLOWS F-28): create → find and join → discuss and reply
// → edit → moderate; roles and handing a community over; layout at the three widths.

const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 834, height: 1112 },
  desktop: { width: 1280, height: 860 },
} as const;

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/feed$/);
  await page.waitForLoadState();
}

async function newPage(browser: Browser, baseURL: string | undefined): Promise<Page> {
  const context = await browser.newContext({ baseURL });
  return context.newPage();
}

async function startCommunity(page: Page, name: string) {
  await page.goto("/community/circles");
  await page.waitForLoadState("networkidle");
  await page.getByRole("link", { name: "Start a community" }).click();
  await expect(page).toHaveURL(/\/community\/circles\/new$/);
  await expect(page.getByRole("heading", { level: 1, name: "Start a community" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Craft").selectOption({ label: "Watercolor" });
  await page.getByLabel("What is it about?").fill("Washes, skies and happy accidents.");
  await page.getByRole("button", { name: "Add a rule" }).click();
  await page.getByLabel("Rule 1", { exact: true }).fill("Be kind to beginners");
  await page.getByRole("button", { name: "Start community" }).click();
  await expect(page).toHaveURL(/\/community\/circles\/(?!new$)[^/]+$/);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await page.waitForLoadState("networkidle");
  return page.url();
}

async function join(page: Page, name: string) {
  await page.goto("/community/circles");
  await page.waitForLoadState("networkidle");
  await page.getByRole("searchbox", { name: "Search communities by name" }).fill(name);
  await page.getByRole("link", { name }).click();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Join", exact: true }).click();
  await expect(page.getByText("Joined", { exact: true })).toBeVisible();
}

test.beforeEach(() => {
  resetRateLimits();
});

test("E2E-34: create a community, join it, discuss, reply, edit and moderate", async ({
  browser,
  page,
  baseURL,
}) => {
  test.setTimeout(150_000);
  const owner = createPasswordAccount({ interests: ["watercolor"] });
  const maker = createPasswordAccount({ interests: ["crochet"] });
  const name = `Washes ${Date.now()}`;

  await signIn(page, owner.email, owner.password);
  const communityUrl = await startCommunity(page, name);
  await expect(page.getByText("Owner", { exact: true })).toBeVisible();
  await page.getByText("Community rules (1)").click();
  await expect(page.getByText("Be kind to beginners")).toBeVisible();

  // Another maker finds it by name, joins and starts a discussion.
  const makerPage = await newPage(browser, baseURL);
  await signIn(makerPage, maker.email, maker.password);
  await join(makerPage, name);
  await makerPage.getByLabel("Start a discussion").fill("How do you stop blooms?");
  await makerPage.getByRole("button", { name: "Post", exact: true }).click();
  // The composer empties and the post joins the list once it is saved.
  await expect(makerPage.getByLabel("Start a discussion")).toHaveValue("");
  await expect(makerPage.getByRole("article").getByText("How do you stop blooms?")).toBeVisible();
  await makerPage.goto("/community/circles");
  await makerPage.waitForLoadState("networkidle");
  await expect(
    makerPage.getByRole("region", { name: "Your circles" }).getByRole("link", { name }),
  ).toBeVisible();
  await makerPage.goto(communityUrl);
  await makerPage.waitForLoadState("networkidle");

  // The owner replies.
  await page.goto(communityUrl);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("How do you stop blooms?")).toBeVisible();
  await page.getByRole("button", { name: "Reply", exact: true }).click();
  await page.getByLabel("Your reply").fill("Add the water in one pass.");
  await page.getByRole("button", { name: "Send reply" }).click();
  await expect(
    page.getByRole("list", { name: "Replies" }).getByText("Add the water in one pass."),
  ).toBeVisible();

  // The maker edits their own post inside the 15 minutes.
  await makerPage.reload();
  await makerPage.waitForLoadState("networkidle");
  await expect(makerPage.getByText("Add the water in one pass.")).toBeVisible();
  await makerPage.getByRole("button", { name: "More options for this post" }).click();
  await makerPage.getByRole("menuitem", { name: "Edit post" }).click();
  await makerPage.getByLabel("Edit your post").fill("How do you stop blooms in a wash?");
  await makerPage.getByRole("button", { name: "Save" }).click();
  await expect(makerPage.getByText("How do you stop blooms in a wash?")).toBeVisible();
  await expect(makerPage.getByText(/· edited/)).toBeVisible();

  // The owner hides the post; the author sees a notice, the owner can restore it.
  await page.reload();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "More options for this post" }).click();
  await page.getByRole("menuitem", { name: "Hide post" }).click();
  await expect(page.getByText("Only moderators can see this post.")).toBeVisible();
  await makerPage.reload();
  await expect(makerPage.getByText(/A moderator hid your post/)).toBeVisible();
  await page.getByRole("button", { name: "More options for this post" }).click();
  await page.getByRole("menuitem", { name: "Restore post" }).click();
  await expect(page.getByText("Only moderators can see this post.")).toHaveCount(0);
});

test("E2E-34: the owner appoints a moderator, hands the community over and leaves", async ({
  browser,
  page,
  baseURL,
}) => {
  test.setTimeout(150_000);
  const owner = createPasswordAccount({ interests: ["watercolor"] });
  const maker = createPasswordAccount({ interests: ["crochet"] });
  const name = `Circle ${Date.now()}`;

  await signIn(page, owner.email, owner.password);
  const communityUrl = await startCommunity(page, name);

  const makerPage = await newPage(browser, baseURL);
  await signIn(makerPage, maker.email, maker.password);
  await join(makerPage, name);

  // Regular members have no Manage item.
  await makerPage.getByRole("button", { name: "More options for this community" }).click();
  await expect(makerPage.getByRole("menuitem", { name: "Manage" })).toHaveCount(0);
  await makerPage.keyboard.press("Escape");

  await page.reload();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "More options for this community" }).click();
  await page.getByRole("menuitem", { name: "Manage" }).click();
  const manage = page.getByRole("dialog", { name: "Manage community" });
  await expect(manage.getByText("Members (2)")).toBeVisible();
  await manage.getByRole("button", { name: /Make .* a moderator/ }).click();
  await expect(manage.getByText(/Moderator$/)).toBeVisible();
  await expect(manage.getByText("changed a role")).toBeVisible();

  // The owner cannot leave without handing over; handing over makes them a moderator.
  await manage.getByRole("button", { name: /Hand the community to/ }).click();
  // The hand-over is done once the owner no longer has a Hand over button to press.
  await expect(manage.getByRole("button", { name: /Hand the community to/ })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Moderator", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "More options for this community" }).click();
  await page.getByRole("menuitem", { name: "Leave community" }).click();
  await page.getByRole("button", { name: "Leave", exact: true }).click();
  await expect(page.getByRole("button", { name: "Join", exact: true })).toBeVisible();

  await makerPage.goto(communityUrl);
  await expect(makerPage.getByText("Owner", { exact: true })).toBeVisible();
});

test("E2E-34: the community screens fit 390, 834 and 1280px with no serious accessibility issues", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const owner = createPasswordAccount({ interests: ["watercolor"] });
  const name = `Layout ${Date.now()}`;
  await signIn(page, owner.email, owner.password);
  const communityUrl = await startCommunity(page, name);

  for (const viewport of Object.values(VIEWPORTS)) {
    await page.setViewportSize(viewport);
    for (const path of ["/community/circles", communityUrl, "/community/circles/new"]) {
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
