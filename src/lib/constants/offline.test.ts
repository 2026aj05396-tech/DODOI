import { describe, expect, it } from "vitest";

import { isReadableOffline } from "./offline";

describe("isReadableOffline", () => {
  it.each([
    "/feed",
    "/p/abc123",
    "/saved",
    "/saved/col1",
    "/explore",
    "/explore/skills",
    "/s/crochet",
    "/t/rainy-day",
  ])("keeps %s for offline use", (path) => {
    expect(isReadableOffline(path)).toBe(true);
  });

  it.each([
    "/",
    "/search",
    "/settings",
    "/settings/account",
    "/sign-in",
    "/onboarding",
    "/admin/posts",
    "/api/feed",
    "/p/abc/edit",
    "/feedback",
  ])("always fetches %s from the network", (path) => {
    expect(isReadableOffline(path)).toBe(false);
  });
});
