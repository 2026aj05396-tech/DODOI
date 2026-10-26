import type { ExperienceLevel } from "@/lib/schemas/me";

import { FEED_CONFIG } from "./config";

// Feed ranking rules (SYSTEM_ARCHITECTURE §7), free of I/O so each rule has a unit test.
// Score = interestMatch + levelFit + freshness + saveAffinity − notInterestedPenalty; then the
// discovery quota (For you only) and the diversity re-ordering.

export type RankCandidate = {
  id: string;
  publishedAt: Date;
  difficulty: ExperienceLevel | null;
  skillIds: string[];
  primarySkillId: string | null;
};

export type RankingContext = {
  interests: Set<string>;
  /** The user's level per skill, where they gave one. */
  levels: Map<string, ExperienceLevel>;
  /** Skills of posts saved recently. */
  savedSkills: Set<string>;
  /** Skills of posts marked "Not interested" recently. */
  notInterestedSkills: Set<string>;
  now: Date;
};

/** `full`: every signal (For you, skill chips). `newToYou`: freshness and level fit only. */
export type RankingMode = "full" | "newToYou";

const LEVELS: ExperienceLevel[] = ["CURIOUS", "BEGINNER", "INTERMEDIATE", "EXPERIENCED"];
const DAY_MS = 24 * 60 * 60 * 1000;

/** True when no skill of the post is among the user's interests (discovery, FEED-11). */
export function isDiscovery(candidate: RankCandidate, interests: Set<string>): boolean {
  return !candidate.skillIds.some((skillId) => interests.has(skillId));
}

export function levelFits(candidate: RankCandidate, context: RankingContext): boolean {
  if (!candidate.difficulty || !candidate.primarySkillId) return false;
  const userLevel = context.levels.get(candidate.primarySkillId) ?? FEED_CONFIG.defaultLevel;
  return LEVELS.indexOf(candidate.difficulty) <= LEVELS.indexOf(userLevel) + 1;
}

export function freshnessPoints(publishedAt: Date, now: Date): number {
  const ageDays = (now.getTime() - publishedAt.getTime()) / DAY_MS;
  return FEED_CONFIG.freshness.find((step) => ageDays < step.maxAgeDays)?.points ?? 0;
}

export function scoreCandidate(
  candidate: RankCandidate,
  context: RankingContext,
  mode: RankingMode,
): number {
  const fit = levelFits(candidate, context) ? FEED_CONFIG.levelFit : 0;
  const fresh = freshnessPoints(candidate.publishedAt, context.now);
  if (mode === "newToYou") return fit + fresh;

  const count = (skills: Set<string>) =>
    candidate.skillIds.filter((skillId) => skills.has(skillId)).length;
  return (
    count(context.interests) * FEED_CONFIG.interestMatchPerSkill +
    fit +
    fresh +
    count(context.savedSkills) * FEED_CONFIG.saveAffinityPerSkill -
    count(context.notInterestedSkills) * FEED_CONFIG.notInterestedPenaltyPerSkill
  );
}

/** Highest score first; ties go to the newer post, then the id (stable across pages). */
function byScore(
  a: { candidate: RankCandidate; score: number },
  b: { candidate: RankCandidate; score: number },
) {
  return (
    b.score - a.score ||
    b.candidate.publishedAt.getTime() - a.candidate.publishedAt.getTime() ||
    (a.candidate.id < b.candidate.id ? 1 : -1)
  );
}

/**
 * Re-orders so no more than `maxSameSkillInARow` items in a row share a main skill, keeping the
 * ranked order otherwise. When only same-skill items are left, they follow anyway.
 */
export function diversify<T extends { primarySkillId: string | null }>(items: T[]): T[] {
  const remaining = [...items];
  const result: T[] = [];
  const limit = FEED_CONFIG.maxSameSkillInARow;
  while (remaining.length > 0) {
    const recent = result.slice(-limit);
    const first = recent[0]?.primarySkillId ?? null;
    const blocked =
      recent.length === limit && first !== null && recent.every((i) => i.primarySkillId === first)
        ? first
        : null;
    const index = blocked ? remaining.findIndex((item) => item.primarySkillId !== blocked) : 0;
    const [next] = remaining.splice(index === -1 ? 0 : index, 1);
    if (next) result.push(next);
  }
  return result;
}

/**
 * One page: the `limit` best candidates. With `discoveryQuota`, at least `discoveryShare` of the
 * page comes from outside the user's interests (when such posts exist), replacing the lowest
 * ranked interest posts. Then diversified.
 */
export function rankPage(
  candidates: RankCandidate[],
  context: RankingContext,
  options: { limit: number; mode: RankingMode; discoveryQuota: boolean },
): RankCandidate[] {
  const ranked = candidates
    .map((candidate) => ({ candidate, score: scoreCandidate(candidate, context, options.mode) }))
    .sort(byScore)
    .map((entry) => entry.candidate);

  let page = ranked.slice(0, options.limit);
  if (options.discoveryQuota && page.length > 0) {
    const needed = Math.ceil(page.length * FEED_CONFIG.discoveryShare);
    const have = page.filter((item) => isDiscovery(item, context.interests)).length;
    if (have < needed) {
      const extra = ranked
        .slice(options.limit)
        .filter((item) => isDiscovery(item, context.interests))
        .slice(0, needed - have);
      // Drop the lowest-ranked interest posts to make room.
      let toDrop = extra.length;
      const kept: RankCandidate[] = [];
      for (const item of [...page].reverse()) {
        if (toDrop > 0 && !isDiscovery(item, context.interests)) toDrop -= 1;
        else kept.unshift(item);
      }
      page = [...kept, ...extra];
    }
  }
  return diversify(page);
}
