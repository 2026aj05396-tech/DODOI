import "server-only";

import {
  MAX_USER_SKILLS,
  MIN_ONBOARDING_INTERESTS,
  type ExperienceLevel,
  type ReplaceUserSkillsInput,
} from "@/lib/schemas/me";
import type { UserSkillItem, UserSkills } from "@/lib/types/me";
import type { Actor } from "@/server/lib/actor";
import { UnauthenticatedError, UnprocessableError, ValidationError } from "@/server/lib/errors";
import { getActiveSkillSummaries } from "@/server/modules/skills";

import {
  findInterestRows,
  findUserSkillRows,
  replaceUserSkillRows,
  setInterestFlag,
  type UserSkillRow,
} from "./repository";

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

/**
 * The user's interests (skill id and level), most recently added first, for the feed (P1-21).
 * Hidden skills are included; the feed only uses them to match posts.
 */
export async function getInterestProfile(
  userId: string,
): Promise<{ skillId: string; level: ExperienceLevel | null }[]> {
  return findInterestRows(userId);
}

/**
 * Adds or removes one interest (skill page, P1-26). Adding needs an active skill and room in the
 * 50-skill limit; removing keeps at least 3 interests (OD-14), like Your skills. The skill's other
 * lists (can help, want to learn) are kept.
 */
export async function setInterest(
  actor: Actor,
  skillId: string,
  isInterest: boolean,
): Promise<void> {
  const userId = requireActorId(actor);
  const rows = await findUserSkillRows(userId);
  const current = rows.find((row) => row.skillId === skillId);
  if (isInterest) {
    if (current?.isInterest) return;
    if ((await getActiveSkillSummaries([skillId])).size === 0) {
      throw new ValidationError("That skill isn't available.", { code: "SKILL_NOT_AVAILABLE" });
    }
    if (!current && rows.length >= MAX_USER_SKILLS) {
      throw new UnprocessableError(`You can add up to ${MAX_USER_SKILLS} skills.`, {
        code: "TOO_MANY_SKILLS",
      });
    }
  } else {
    if (!current?.isInterest) return;
    if ((await countMyInterests(userId)) <= MIN_ONBOARDING_INTERESTS) {
      throw new UnprocessableError(
        `Keep at least ${MIN_ONBOARDING_INTERESTS} interests so your feed has something to go on.`,
        { code: "NOT_ENOUGH_INTERESTS" },
      );
    }
  }
  await setInterestFlag(userId, skillId, isInterest);
}
