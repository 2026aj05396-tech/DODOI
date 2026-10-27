import { describe, expect, it } from "vitest";

import { isActivePath, profileNavItem } from "./nav-items";

describe("isActivePath", () => {
  it("matches the page itself and its sub-pages only", () => {
    expect(isActivePath("/explore", "/explore")).toBe(true);
    expect(isActivePath("/explore/themes", "/explore")).toBe(true);
    expect(isActivePath("/explorer", "/explore")).toBe(false);
    expect(isActivePath("/feed", undefined)).toBe(false);
  });
});

describe("profileNavItem", () => {
  it("links to the user's profile, or to /profile when the shell doesn't know the username", () => {
    expect(profileNavItem("aanya-4821").href).toBe("/u/aanya-4821");
    expect(profileNavItem(null).href).toBe("/profile");
  });
});
