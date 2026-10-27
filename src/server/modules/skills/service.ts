import "server-only";

import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { MAX_PAGE_SIZE } from "@/lib/constants/pagination";
import type { CreateCustomSkillInput, ListSkillsQuery } from "@/lib/schemas/skills";
import type { Paginated } from "@/lib/types/api";
import type { SkillDetail, SkillSummary } from "@/lib/types/skills";
import type { Actor, AuthenticatedActor } from "@/server/lib/actor";
import {
  ForbiddenError,
  NotFoundError,
  UnauthenticatedError,
  ValidationError,
} from "@/server/lib/errors";
import { decodeCursor, encodeCursor } from "@/server/lib/pagination";
import { enforceRateLimit, type RateLimitRule } from "@/server/lib/rate-limit";

import { BLOCKED_SKILL_TERMS } from "./blocked-terms";
import { createBlocklistMatcher } from "./blocklist";
import {
  isValidSkillNameShape,
  pickSkillAccent,
  SKILL_NAME_MAX_LENGTH,
  SKILL_NAME_MIN_LENGTH,
  toNormalizedSkillName,
  toSkillDisplayName,
  toSkillSlug,
} from "./normalize";
import { canCreateCustomSkill } from "./policies";
import {
  findActiveSkillDetailBySlug,
  findActiveSkillsByIds,
  findHintedSkills,
  findSkillsForModeration,
  findNewestActiveSkills,
  findPitchedSkills,
  updateSkillStatus,
  findSkillsBySlugs,
  findSkillStatuses,
  findSkillByNormalizedName,
  findSlugsStartingWith,
  insertCustomSkill,
  listActiveSkills,
  searchActiveSkills,
  type SkillSummaryRow,
} from "./repository";

/** SECURITY_AND_PRIVACY §6: custom skill creation, 10 per day per user. */
export const CUSTOM_SKILL_RATE_LIMIT: RateLimitRule = {
  name: "custom-skill-create",
  limit: 10,
  windowSeconds: 24 * 60 * 60,
};

const isBlockedByDefault = createBlocklistMatcher(BLOCKED_SKILL_TERMS);

const listCursorSchema = z.object({ name: z.string(), id: z.string() });
const searchCursorSchema = z.object({ offset: z.number().int().min(0) });

function requireActor(actor: Actor): AuthenticatedActor {
  if (!actor) throw new UnauthenticatedError();
  return actor;
}

function toSummary(row: SkillSummaryRow): SkillSummary {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    accent: row.accent,
    origin: row.origin,
    hint: row.hint,
  };
}

/** Active skills for the onboarding picker and search suggestions; signed-in users only (OD-29). */
export async function listSkills(
  actor: Actor,
  query: ListSkillsQuery,
): Promise<Paginated<SkillSummary>> {
  requireActor(actor);
  const take = query.limit + 1;

  if (query.q) {
    const offset = query.cursor ? decodeCursor(query.cursor, searchCursorSchema).offset : 0;
    const rows = await searchActiveSkills({
      term: toNormalizedSkillName(query.q),
      origin: query.origin,
      offset,
      take,
    });
    const page = rows.slice(0, query.limit);
    return {
      items: page.map(toSummary),
      nextCursor: rows.length > query.limit ? encodeCursor({ offset: offset + query.limit }) : null,
    };
  }

  const after = query.cursor ? decodeCursor(query.cursor, listCursorSchema) : undefined;
  const rows = await listActiveSkills({ origin: query.origin, after, take });
  const page = rows.slice(0, query.limit);
  const last = page.at(-1);
  return {
    items: page.map(toSummary),
    nextCursor:
      rows.length > query.limit && last ? encodeCursor({ name: last.name, id: last.id }) : null,
  };
}

export async function getSkillBySlug(actor: Actor, slug: string): Promise<SkillDetail> {
  requireActor(actor);
  const skill = await findActiveSkillDetailBySlug(slug);
  if (!skill) throw new NotFoundError("We couldn't find that skill.");

  return {
    ...toSummary(skill),
    description: skill.description,
    hint: skill.hint,
    pitch: skill.pitch,
    relatedSkills: skill.relatedFrom.map((relation) => toSummary(relation.to)),
  };
}

async function chooseAvailableSlug(displayName: string): Promise<string> {
  const base = toSkillSlug(displayName) || "skill";
  const taken = new Set(await findSlugsStartingWith(base));
  if (!taken.has(base)) return base;
  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

type ResolveOptions = {
  /** Replaces the default blocklist (tests). */
  isBlocked?: (name: string) => boolean;
};

/**
 * "Add your own" interest (ONB-04, OD-13): returns the existing skill when the normalised name is
 * already known, otherwise creates a public CUSTOM skill. `created` tells the caller which happened.
 */
export async function resolveCustomSkill(
  actor: Actor,
  input: CreateCustomSkillInput,
  { isBlocked = isBlockedByDefault }: ResolveOptions = {},
): Promise<{ skill: SkillSummary; created: boolean }> {
  const user = requireActor(actor);
  if (!canCreateCustomSkill(user)) {
    throw new ForbiddenError("Verify your email to add new interests.", {
      code: "EMAIL_NOT_VERIFIED",
    });
  }

  const displayName = toSkillDisplayName(input.name);
  if (!isValidSkillNameShape(displayName)) {
    throw new ValidationError(undefined, {
      fields: {
        name: `Use ${SKILL_NAME_MIN_LENGTH}–${SKILL_NAME_MAX_LENGTH} letters, numbers, spaces, - ' or &.`,
      },
    });
  }

  const normalizedName = toNormalizedSkillName(displayName);
  const existing = await findSkillByNormalizedName(normalizedName);
  if (existing?.status === "ACTIVE") return { skill: toSummary(existing), created: false };

  // Hidden skills were removed by an admin; they must not come back through "add your own".
  if (existing || isBlocked(displayName)) {
    throw new ValidationError("That name can't be used. Try describing the craft differently.", {
      code: "SKILL_NAME_NOT_ALLOWED",
      fields: { name: "That name can't be used." },
    });
  }

  await enforceRateLimit(CUSTOM_SKILL_RATE_LIMIT, user.id);

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const skill = await insertCustomSkill({
        name: displayName,
        normalizedName,
        slug: await chooseAvailableSlug(displayName),
        accent: pickSkillAccent(normalizedName),
        createdById: user.id,
      });
      return { skill: toSummary(skill), created: true };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      // Someone added the same name at the same moment: reuse theirs. Otherwise the slug collided.
      const concurrent = await findSkillByNormalizedName(normalizedName);
      if (concurrent?.status === "ACTIVE") return { skill: toSummary(concurrent), created: false };
    }
  }
  throw new Error("Could not create a unique slug for a custom skill");
}

/** Every active predefined skill, alphabetically (the onboarding and "Your skills" catalogue). */
export async function listPredefinedSkills(actor: Actor): Promise<SkillSummary[]> {
  const skills: SkillSummary[] = [];
  let cursor: string | undefined;
  do {
    const page = await listSkills(actor, { origin: "PREDEFINED", limit: MAX_PAGE_SIZE, cursor });
    skills.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return skills;
}

/**
 * Active skills among `ids`, keyed by id (for other modules, e.g. a user's skill list). Hidden
 * or unknown ids are simply absent.
 */
export async function getActiveSkillSummaries(ids: string[]): Promise<Map<string, SkillSummary>> {
  if (ids.length === 0) return new Map();
  const rows = await findActiveSkillsByIds(ids);
  return new Map(rows.map((row) => [row.id, toSummary(row)]));
}

/** Status of each existing skill among `ids` (hidden ones included), keyed by id. */
/** Skills by slug, hidden ones included (seed importer: slugs are the same in every environment). */
export async function getSkillsBySlugs(
  slugs: string[],
): Promise<Map<string, { id: string; status: "ACTIVE" | "HIDDEN" }>> {
  if (slugs.length === 0) return new Map();
  const rows = await findSkillsBySlugs(slugs);
  return new Map(rows.map((row) => [row.slug, { id: row.id, status: row.status }]));
}

export async function getSkillStatuses(ids: string[]): Promise<Map<string, "ACTIVE" | "HIDDEN">> {
  if (ids.length === 0) return new Map();
  const rows = await findSkillStatuses(ids);
  return new Map(rows.map((row) => [row.id, row.status]));
}

export type SkillSuggestionCandidate = {
  skill: SkillSummary;
  pitch: string;
  coverMediaId: string | null;
  /** Related (SkillRelation) to one of the user's interests. */
  isRelated: boolean;
};

/**
 * Skills the feed may suggest (FEED-14): active, with an admin-written pitch, not among
 * `interestIds`. The feed adds the beginner-post rule and picks one.
 */
export async function getSuggestionCandidates(
  interestIds: string[],
): Promise<SkillSuggestionCandidate[]> {
  const interests = new Set(interestIds);
  const rows = await findPitchedSkills(interestIds);
  return rows.map((row) => ({
    skill: toSummary(row),
    pitch: row.pitch ?? "",
    coverMediaId: row.coverMediaId,
    isRelated: row.relatedFrom.some((relation) => interests.has(relation.toSkillId)),
  }));
}

/**
 * True when the text contains an offensive word (LDNOOBW + Hinglish, OD-36), matched on whole
 * words. Also used for usernames and display names (PO decision, P1-13).
 */
export function containsOffensiveWords(text: string): boolean {
  return isBlockedByDefault(text);
}

/** Most recently added active skills, newest first (Explore). */
export async function getNewestSkills(take: number): Promise<SkillSummary[]> {
  return (await findNewestActiveSkills(take)).map(toSummary);
}

/**
 * "Skills to try" (Explore, SRCH-05/08): active skills with an editor's hint that aren't among
 * `interestIds`; those related to an interest first, then by name.
 */
export async function getSkillsToTry(
  interestIds: string[],
  take: number,
): Promise<{ skill: SkillSummary; hint: string }[]> {
  const interests = new Set(interestIds);
  const rows = await findHintedSkills(interestIds);
  return rows
    .map((row) => ({
      skill: toSummary(row),
      hint: row.hint ?? "",
      isRelated: row.relatedFrom.some((relation) => interests.has(relation.toSkillId)),
    }))
    .sort((a, b) => Number(b.isRelated) - Number(a.isRelated))
    .slice(0, take)
    .map(({ skill, hint }) => ({ skill, hint }));
}

export type ModerationSkill = {
  id: string;
  name: string;
  slug: string;
  origin: "PREDEFINED" | "CUSTOM";
  status: "ACTIVE" | "HIDDEN";
};

/** Skills by id for moderation (hidden ones included), keyed by id. */
export async function getSkillsForModeration(ids: string[]): Promise<Map<string, ModerationSkill>> {
  if (ids.length === 0) return new Map();
  return new Map((await findSkillsForModeration(ids)).map((row) => [row.id, row]));
}

/**
 * Hides or shows a skill after a report (P1-28b). The caller checks the actor is an admin and
 * writes the audit entry; hidden skills disappear from pickers, search and skill pages.
 */
export async function setSkillHidden(id: string, hidden: boolean): Promise<void> {
  await updateSkillStatus(id, hidden ? "HIDDEN" : "ACTIVE");
}
