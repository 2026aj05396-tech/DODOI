import "server-only";

import { db } from "@/server/db/client";

import {
  isValidSkillNameShape,
  toNormalizedSkillName,
  toSkillDisplayName,
  toSkillSlug,
} from "./normalize";

// Loads the predefined skills (prisma/seed/skills.json, OD-30). Idempotent: running it again
// updates texts and accents but never duplicates skills, changes slugs (URLs stay stable) or
// un-hides a skill an admin hid. Skills removed from the file are left alone, because users and
// posts may already reference them.

export type PredefinedSkill = {
  name: string;
  slug: string;
  accent: "BUTTER" | "BLUSH" | "LAVENDER" | "MINT" | "SKY" | "CORAL";
  description: string;
  pitch: string;
  hint: string;
};

export type PredefinedSkillsData = {
  skills: PredefinedSkill[];
  relatedPairs: [string, string][];
};

export type SeedSkillsResult = { created: number; updated: number; relations: number };

function assertValid(data: PredefinedSkillsData): void {
  for (const skill of data.skills) {
    const displayName = toSkillDisplayName(skill.name);
    if (!isValidSkillNameShape(displayName) || skill.slug !== toSkillSlug(displayName)) {
      throw new Error(`Invalid predefined skill "${skill.name}" (check name and slug)`);
    }
  }
}

export async function seedPredefinedSkills(data: PredefinedSkillsData): Promise<SeedSkillsResult> {
  assertValid(data);
  let created = 0;
  let updated = 0;

  for (const skill of data.skills) {
    const name = toSkillDisplayName(skill.name);
    const texts = {
      name,
      description: skill.description,
      pitch: skill.pitch,
      hint: skill.hint,
      accent: skill.accent,
    };
    const normalizedName = toNormalizedSkillName(name);
    const existing = await db.skill.findUnique({ where: { normalizedName }, select: { id: true } });
    if (existing) {
      // A user may have added this name as a custom interest first; it becomes the official skill.
      await db.skill.update({
        where: { id: existing.id },
        data: { ...texts, origin: "PREDEFINED" },
      });
      updated += 1;
    } else {
      await db.skill.create({
        data: { ...texts, normalizedName, slug: skill.slug, origin: "PREDEFINED" },
      });
      created += 1;
    }
  }

  const skills = await db.skill.findMany({
    where: {
      normalizedName: { in: data.skills.map((skill) => toNormalizedSkillName(skill.name)) },
    },
    select: { id: true, normalizedName: true },
  });
  const idByNormalizedName = new Map(skills.map((skill) => [skill.normalizedName, skill.id]));
  const idBySlug = new Map(
    data.skills.map((skill) => [
      skill.slug,
      idByNormalizedName.get(toNormalizedSkillName(skill.name)),
    ]),
  );

  // Related skills are symmetric, so each pair is stored in both directions.
  const relations = data.relatedPairs.flatMap(([fromSlug, toSlug]) => {
    const fromId = idBySlug.get(fromSlug);
    const toId = idBySlug.get(toSlug);
    if (!fromId || !toId)
      throw new Error(`Related pair refers to unknown skill: ${fromSlug} / ${toSlug}`);
    return [
      { fromSkillId: fromId, toSkillId: toId },
      { fromSkillId: toId, toSkillId: fromId },
    ];
  });
  const { count } = await db.skillRelation.createMany({ data: relations, skipDuplicates: true });

  return { created, updated, relations: count };
}
