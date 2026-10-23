import { describe, expect, it } from "vitest";

import { BLOCKED_SKILL_TERMS, CRAFT_SAFE_EXCEPTION_TERMS } from "./blocked-terms";
import { createBlocklistMatcher } from "./blocklist";

const isBlocked = createBlocklistMatcher(BLOCKED_SKILL_TERMS);

describe("custom interest blocklist (LDNOOBW English + Hinglish)", () => {
  it("blocks offensive English and romanised Hindi names", () => {
    expect(isBlocked("NSFW art")).toBe(true);
    expect(isBlocked("Porn sketches")).toBe(true);
    expect(isBlocked("Harami crafts")).toBe(true);
  });

  it.each([
    "Fingering yarn knitting",
    "Swastika rangoli",
    "Butt joint woodworking",
    "Blue tit embroidery",
    "Nude figure drawing",
    "Lingerie and panty sewing",
    "Jelly donut cake decorating",
    "Diwali patakha crafts",
    "Kutta portraits",
  ])("allows the craft name %s", (name) => {
    expect(isBlocked(name)).toBe(false);
  });

  it("keeps every exception out of the active list", () => {
    for (const term of CRAFT_SAFE_EXCEPTION_TERMS) {
      expect(BLOCKED_SKILL_TERMS).not.toContain(term);
    }
  });

  it.each([
    "Crochet",
    "Embroidery",
    "Pipe cleaner art",
    "Watercolor",
    "Macramé",
    "Pottery",
    "कढ़ाई",
  ])("never blocks common craft names like %s", (name) => {
    expect(isBlocked(name)).toBe(false);
  });
});
