import { describe, expect, it } from "vitest";

import { BLOCKED_SKILL_TERMS } from "./blocked-terms";
import { createBlocklistMatcher } from "./blocklist";
import { isValidSkillNameShape, toNormalizedSkillName, toSkillSlug } from "./normalize";
import seed from "../../../../prisma/seed/skills.json";

// Guards prisma/seed/skills.json (OD-30) against the same rules the app applies.
const isBlocked = createBlocklistMatcher(BLOCKED_SKILL_TERMS);
const ACCENTS = new Set(["BUTTER", "BLUSH", "LAVENDER", "MINT", "SKY", "CORAL"]);

describe("predefined skills seed", () => {
  it("has at least 40 skills, as the landing page promises", () => {
    expect(seed.skills.length).toBeGreaterThanOrEqual(40);
  });

  it.each(seed.skills.map((skill) => [skill.name, skill] as const))(
    "%s follows the skill rules",
    (_name, skill) => {
      expect(isValidSkillNameShape(skill.name)).toBe(true);
      expect(isBlocked(skill.name)).toBe(false);
      expect(skill.slug).toBe(toSkillSlug(skill.name));
      expect(ACCENTS.has(skill.accent)).toBe(true);
      expect(skill.pitch.length).toBeLessThanOrEqual(140);
      expect(skill.hint.length).toBeLessThanOrEqual(40);
      expect(skill.description.length).toBeGreaterThan(0);
    },
  );

  it("has no duplicate names or slugs", () => {
    const names = seed.skills.map((skill) => toNormalizedSkillName(skill.name));
    const slugs = seed.skills.map((skill) => skill.slug);
    expect(new Set(names).size).toBe(names.length);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("only relates skills that exist, never a skill to itself", () => {
    const slugs = new Set(seed.skills.map((skill) => skill.slug));
    for (const [from, to] of seed.relatedPairs) {
      expect(slugs.has(from ?? "")).toBe(true);
      expect(slugs.has(to ?? "")).toBe(true);
      expect(from).not.toBe(to);
    }
  });
});
