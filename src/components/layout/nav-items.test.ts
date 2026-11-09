import { describe, expect, it } from "vitest";

import { COMMUNITY, SESSIONS, isActivePath, profileNavItem } from "./nav-items";

describe("isActivePath", () => {
  it("matches the page itself and its sub-pages only", () => {
    expect(isActivePath("/explore", "/explore")).toBe(true);
    expect(isActivePath("/explore/themes", "/explore")).toBe(true);
    expect(isActivePath("/explorer", "/explore")).toBe(false);
    expect(isActivePath("/feed", undefined)).toBe(false);
  });
});

describe("Sessions entry", () => {
  it("is active on Sessions pages, where Community is not", () => {
    expect(isActivePath("/community/sessions", SESSIONS.href)).toBe(true);
    expect(isActivePath("/community/sessions/new", SESSIONS.href)).toBe(true);
    expect(isActivePath("/community/sessions", COMMUNITY.href)).toBe(false);
    expect(isActivePath("/community/circles", COMMUNITY.href)).toBe(true);
    expect(isActivePath("/community", COMMUNITY.href)).toBe(true);
  });
});

describe("profileNavItem", () => {
  it("links to the user's profile, or to /profile when the shell doesn't know the username", () => {
    expect(profileNavItem("aanya-4821").href).toBe("/u/aanya-4821");
    expect(profileNavItem(null).href).toBe("/profile");
  });
});
