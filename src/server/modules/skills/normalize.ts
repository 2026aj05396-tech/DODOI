import type { SkillAccent } from "@/generated/prisma/client";

// Skill name rules (PRODUCT_REQUIREMENTS §5.2, OD-13).

export const SKILL_NAME_MIN_LENGTH = 2;
export const SKILL_NAME_MAX_LENGTH = 40;

/** Letters and marks of any script (Devanagari vowel signs are marks), digits, spaces, - ' & */
const ALLOWED_SKILL_NAME = /^[\p{L}\p{M}\p{N} '&-]+$/u;

/** Display form: Unicode-normalised, trimmed, inner whitespace collapsed. Case is kept. */
export function toSkillDisplayName(raw: string): string {
  return raw.normalize("NFKC").trim().replace(/\s+/gu, " ");
}

/** Comparison key that makes " Crochet " and "crochet" the same skill. */
export function toNormalizedSkillName(raw: string): string {
  return toSkillDisplayName(raw).toLocaleLowerCase("en");
}

export function isValidSkillNameShape(displayName: string): boolean {
  const length = [...displayName].length;
  return (
    length >= SKILL_NAME_MIN_LENGTH &&
    length <= SKILL_NAME_MAX_LENGTH &&
    ALLOWED_SKILL_NAME.test(displayName)
  );
}

/** URL slug that keeps non-Latin scripts readable, e.g. "Pipe cleaner art" → "pipe-cleaner-art". */
export function toSkillSlug(displayName: string): string {
  return toNormalizedSkillName(displayName)
    .replace(/[&']/gu, "")
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
}

const ACCENTS: readonly SkillAccent[] = ["BUTTER", "BLUSH", "LAVENDER", "MINT", "SKY", "CORAL"];

/** Picks a design accent deterministically, so the same name always gets the same colour. */
export function pickSkillAccent(normalizedName: string): SkillAccent {
  let hash = 0;
  for (const character of normalizedName) {
    hash = (hash * 31 + (character.codePointAt(0) ?? 0)) >>> 0;
  }
  return ACCENTS[hash % ACCENTS.length] ?? "BUTTER";
}
