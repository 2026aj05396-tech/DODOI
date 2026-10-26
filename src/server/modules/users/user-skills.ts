import "server-only";

import type { ReplaceUserSkillsInput } from "@/lib/schemas/me";
import type { UserSkillItem, UserSkills } from "@/lib/types/me";
import type { Actor } from "@/server/lib/actor";
import { UnauthenticatedError, ValidationError } from "@/server/lib/errors";
import { getActiveSkillSummaries } from "@/server/modules/skills";

import { findUserSkillRows, replaceUserSkillRows, type UserSkillRow } from "./repository";

// The signed-in user's skills: interests, can help, want to learn, level (ONB-02…06, ONB-08).

function requireActorId(actor: Actor): string {
  if (!actor) throw new UnauthenticatedError();
  return actor.id;
}

function hasAnyFlag(row: UserSkillRow): boolean {
  return row.isInterest || row.canHelp || row.wantsToLearn;
}

/** The user's skills, in the order they were added. Hidden skills are left out. */
export async function getMySkills(actor: Actor): Promise<UserSkills> {
  const rows = await findUserSkillRows(requireActorId(actor));
  const skills = await getActiveSkillSummaries(rows.map((row) => row.skillId));
  const items: UserSkillItem[] = rows.flatMap(({ skillId, ...flags }) => {
    const skill = skills.get(skillId);
    return skill ? [{ skill, ...flags }] : [];
  });
  return { items };
}

/** Number of active skills the user has marked as interests (onboarding needs 3). */
export async function countMyInterests(userId: string): Promise<number> {
  const interests = (await findUserSkillRows(userId)).filter((row) => row.isInterest);
  const active = await getActiveSkillSummaries(interests.map((row) => row.skillId));
  return active.size;
}

/**
 * Replaces the whole set (PUT /api/me/skills). Rows with no flag set are dropped; every remaining
 * skill must exist and be active. Returns the new set.
 */
export async function replaceMySkills(
  actor: Actor,
  input: ReplaceUserSkillsInput,
): Promise<UserSkills> {
  const userId = requireActorId(actor);
  const rows = input.items.filter(hasAnyFlag);
  const active = await getActiveSkillSummaries(rows.map((row) => row.skillId));

  const fields: Record<string, string> = {};
  input.items.forEach((item, index) => {
    if (hasAnyFlag(item) && !active.has(item.skillId)) {
      fields[`items.${index}.skillId`] = "This skill isn't available any more.";
    }
  });
  if (Object.keys(fields).length > 0) {
    throw new ValidationError("Some skills aren't available any more. Remove them and try again.", {
      code: "SKILL_NOT_AVAILABLE",
      fields,
    });
  }

  await replaceUserSkillRows(userId, rows);
  return getMySkills(actor);
}
