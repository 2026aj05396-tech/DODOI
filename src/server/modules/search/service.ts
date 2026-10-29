import "server-only";

import { z } from "zod";

import type { SearchQuery } from "@/lib/schemas/search";
import type { Paginated } from "@/lib/types/api";
import type { CreatorSummary, PostCard } from "@/lib/types/posts";
import type { ExploreData, SearchAll, SearchResults } from "@/lib/types/search";
import type { SkillSummary } from "@/lib/types/skills";
import { mediaProvider as defaultProvider, type MediaProvider } from "@/server/integrations/media";
import type { Actor, AuthenticatedActor } from "@/server/lib/actor";
import { UnauthenticatedError } from "@/server/lib/errors";
import { decodeCursor, encodeCursor } from "@/server/lib/pagination";
import { enforceRateLimit, type RateLimitRule } from "@/server/lib/rate-limit";
import { getSaveCountsBySkill } from "@/server/modules/collections";
import {
  avatarUrl,
  getBeginnerPostIds,
  getPostCards,
  getPublishedPostCountsBySkill,
  listThemes,
  searchPostIds,
} from "@/server/modules/content";
import {
  getActiveSkillSummaries,
  getNewestSkills,
  getSkillsToTry,
  listSkills,
} from "@/server/modules/skills";
import {
  getBlockedUserIds,
  getInterestProfile,
  getUsernames,
  searchCreators,
} from "@/server/modules/users";

// Search and Explore (SRCH-01…08, API_SPECIFICATION §5). This module owns no tables: each query
// lives in the module that owns the data (posts in content, makers in users, skills in skills,
// saves in collections); here they are combined, limited and paged.

type ProviderOption = { provider?: MediaProvider };

/** SECURITY_AND_PRIVACY §6: search, 60 per minute per user. */
export const SEARCH_RATE_LIMIT: RateLimitRule = {
  name: "search-user",
  limit: 60,
  windowSeconds: 60,
};

/** `type=all`: up to this many of each kind. */
const ALL_LIMIT = 8;
const MAX_WORDS = 8;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Explore (PO decisions, P1-23): 8 popular, 8 new, 8 to try, 12 beginner-friendly posts. */
export const EXPLORE_LIMITS = {
  popular: 8,
  newest: 8,
  toTry: 8,
  beginner: 12,
  popularWindowDays: 30,
} as const;

const offsetCursorSchema = z.object({ offset: z.number().int().min(0) });

function requireSignedIn(actor: Actor): AuthenticatedActor {
  if (!actor) throw new UnauthenticatedError();
  return actor;
}

/** Letters and digits only (any script), so they are safe as prefix terms in a tsquery. */
export function searchWords(term: string): string[] {
  return term
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .split(/[^\p{L}\p{M}\p{N}]+/u)
    .filter(Boolean)
    .slice(0, MAX_WORDS);
}

function offsetOf(cursor: string | undefined): number {
  return cursor ? decodeCursor(cursor, offsetCursorSchema).offset : 0;
}

/** Fetches one more than the page to know whether there is a next one. */
function toPage<T>(rows: T[], offset: number, limit: number): Paginated<T> {
  return {
    items: rows.slice(0, limit),
    nextCursor: rows.length > limit ? encodeCursor({ offset: offset + limit }) : null,
  };
}

async function findCreators(
  actor: AuthenticatedActor,
  term: string,
  page: { offset: number; take: number },
  provider: MediaProvider,
): Promise<CreatorSummary[]> {
  const [found, blocked] = await Promise.all([
    searchCreators(term, page),
    getBlockedUserIds(actor.id),
  ]);
  // Blocked people are left out both ways (MOD-02).
  const blockedNames = new Set((await getUsernames([...blocked])).values());
  const rows = found.filter((row) => !blockedNames.has(row.username));
  return rows.map((row) => ({
    username: row.username,
    displayName: row.displayName,
    avatarUrl: row.avatarPublicId ? avatarUrl(row.avatarPublicId, { provider }) : null,
  }));
}

async function findPosts(
  actor: AuthenticatedActor,
  term: string,
  page: { offset: number; take: number },
  provider: MediaProvider,
): Promise<PostCard[]> {
  return getPostCards(actor, await searchPostIds(searchWords(term), term, page), { provider });
}

/**
 * GET /api/search: posts, skills (custom ones too, SRCH-07) and makers. Typo tolerant ("croch"
 * finds Crochet); private, hidden and deactivated profiles never appear (OD-10).
 */
export async function search(
  actor: Actor,
  query: SearchQuery,
  { provider = defaultProvider }: ProviderOption = {},
): Promise<SearchResults> {
  const user = requireSignedIn(actor);
  await enforceRateLimit(SEARCH_RATE_LIMIT, user.id);
  const term = query.q;

  if (query.type === "all") {
    const page = { offset: 0, take: ALL_LIMIT };
    const [posts, skills, creators] = await Promise.all([
      findPosts(user, term, page, provider),
      listSkills(user, { q: term, limit: ALL_LIMIT }),
      findCreators(user, term, page, provider),
    ]);
    const results: SearchAll = { posts, skills: skills.items, creators };
    return results;
  }
  if (query.type === "skills") {
    return listSkills(user, { q: term, limit: query.limit, cursor: query.cursor });
  }
  const offset = offsetOf(query.cursor);
  const page = { offset, take: query.limit + 1 };
  if (query.type === "posts") {
    return toPage(await findPosts(user, term, page, provider), offset, query.limit);
  }
  return toPage(await findCreators(user, term, page, provider), offset, query.limit);
}

/** Skill ids by how often their posts were saved lately, then by how many posts they have. */
async function popularSkillIds(): Promise<string[]> {
  const since = new Date(Date.now() - EXPLORE_LIMITS.popularWindowDays * DAY_MS);
  const [saves, posts] = await Promise.all([
    getSaveCountsBySkill(since),
    getPublishedPostCountsBySkill(),
  ]);
  const bySaves = [...saves.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  const byPosts = [...posts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  // Top up with the skills that have the most posts, so the list is never empty (PO, P1-23).
  return [...new Set([...bySaves, ...byPosts])];
}

/** GET /api/explore (SRCH-05). */
export async function explore(
  actor: Actor,
  { provider = defaultProvider }: ProviderOption = {},
): Promise<ExploreData> {
  const user = requireSignedIn(actor);
  const interests = (await getInterestProfile(user.id)).map((row) => row.skillId);
  const [popularIds, newSkills, skillsToTry, themes, beginnerIds] = await Promise.all([
    popularSkillIds(),
    getNewestSkills(EXPLORE_LIMITS.newest),
    getSkillsToTry(interests, EXPLORE_LIMITS.toTry),
    listThemes(user, { provider }),
    getBeginnerPostIds(EXPLORE_LIMITS.beginner),
  ]);
  const summaries = await getActiveSkillSummaries(popularIds);
  const popularSkills = popularIds
    .flatMap((id): SkillSummary[] => {
      const skill = summaries.get(id);
      return skill ? [skill] : [];
    })
    .slice(0, EXPLORE_LIMITS.popular);
  return {
    popularSkills,
    newSkills,
    skillsToTry,
    themes,
    beginnerFriendly: await getPostCards(user, beginnerIds, { provider }),
  };
}
