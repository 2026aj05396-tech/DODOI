import { describe, expect, it } from "vitest";

import {
  isValidSkillNameShape,
  pickSkillAccent,
  toNormalizedSkillName,
  toSkillDisplayName,
  toSkillSlug,
} from "./normalize";

describe("skill name normalisation", () => {
  it("trims and collapses whitespace but keeps the user's casing for display", () => {
    expect(toSkillDisplayName("  Pipe   cleaner\tart ")).toBe("Pipe cleaner art");
  });

  it("makes differently spaced or cased names compare equal", () => {
    expect(toNormalizedSkillName(" Crochet ")).toBe(toNormalizedSkillName("crochet"));
  });

  it("folds full-width characters into their normal form", () => {
    expect(toNormalizedSkillName("Ｃｒｏｃｈｅｔ")).toBe("crochet");
  });
});

describe("isValidSkillNameShape", () => {
  it.each(["Macramé", "Paper quilling", "Arts & crafts", "Kid's crafts", "3D printing", "कढ़ाई"])(
    "accepts %s",
    (name) => {
      expect(isValidSkillNameShape(name)).toBe(true);
    },
  );

  it.each([
    ["too short", "a"],
    ["too long", "a".repeat(41)],
    ["symbols", "crochet!!!"],
    ["emoji", "knitting 🧶"],
    ["links", "visit http://x"],
  ])("rejects %s", (_label, name) => {
    expect(isValidSkillNameShape(name)).toBe(false);
  });
});

describe("toSkillSlug", () => {
  it("builds readable slugs, including for non-Latin scripts", () => {
    expect(toSkillSlug("Pipe cleaner art")).toBe("pipe-cleaner-art");
    expect(toSkillSlug("Arts & crafts")).toBe("arts-crafts");
    expect(toSkillSlug("Kid's crafts")).toBe("kids-crafts");
    expect(toSkillSlug("कढ़ाई")).toBe("कढ़ाई");
  });
});

describe("pickSkillAccent", () => {
  it("always gives the same name the same accent", () => {
    expect(pickSkillAccent("crochet")).toBe(pickSkillAccent("crochet"));
  });
});
