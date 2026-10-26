import "server-only";

import { z } from "zod";

import type { FeedFeedbackInput, FeedQuery } from "@/lib/schemas/feed";
import type { ExperienceLevel } from "@/lib/schemas/me";
import type { FeedFilterChip, FeedPage, SkillSuggestion } from "@/lib/types/feed";
import { mediaProvider as defaultProvider, type MediaProvider } from "@/server/integrations/media";
import type { Actor, AuthenticatedActor } from "@/server/lib/actor";
import { NotFoundError, UnauthenticatedError, ValidationError } from "@/server/lib/errors";
import { decodeCursor, encodeCursor } from "@/server/lib/pagination";
import { getRecentlySavedSkillIds } from "@/server/modules/collections";
import {
  getBeginnerProjectCounts,
  getFeedCandidates,
  getMedia,
  getPostCards,
  isPostPublished,
} from "@/server/modules/content";
import {
  getActiveSkillSummaries,
  getSkillsBySlugs,
  getSuggestionCandidates,
} from "@/server/modules/skills";
import { getInterestProfile } from "@/server/modules/users";

import { FEED_CONFIG } from "./config";
import { rankPage, type RankingContext } from "./ranking";
import {
  deleteNotInterested,
  findNotInterested,
  findServedPostIds,
  findSession,
  insertImpressions,
  insertSession,
  upsertNotInterested,
} from "./repository";

// Home feed (FEED-01…14, SYSTEM_ARCHITECTURE §7, API_SPECIFICATION §5). A page request without a
// cursor starts a feed session for its filter; served posts are recorded so a session never repeats
// a post (FEED-09). Posts marked "Not interested" never come back and weigh down their skills.

type ProviderOption = { provider?: MediaProvider };

const DAY_MS = 24 * 60 * 60 * 1000;
const cursorSchema = z.object({ session: z.string().min(1), page: z.number().int().min(1) });

function requireSignedIn(actor: Actor): AuthenticatedActor {
  if (!actor) throw new UnauthenticatedError();
  return actor;
}

type Profile = {
  interestIds: string[];
  levels: Map<string, ExperienceLevel>;
};

async function loadProfile(userId: string): Promise<Profile> {
  const rows = await getInterestProfile(userId);
  return {
    interestIds: rows.map((row) => row.skillId),
    levels: new Map(rows.flatMap((row) => (row.level ? [[row.skillId, row.level]] : []))),
  };
}

/** The skill id behind `skill:<slug>`; it must be one of the user's interests. */
async function resolveSkillFilter(filter: string, profile: Profile): Promise<string | undefined> {
  if (!filter.startsWith("skill:")) return undefined;
  const slug = filter.slice("skill:".length);
  const skill = (await getSkillsBySlugs([slug])).get(slug);
  if (!skill || skill.status !== "ACTIVE" || !profile.interestIds.includes(skill.id)) {
    throw new ValidationError("That filter isn't available.", {
      code: "INVALID_FILTER",
      fields: { filter: "Choose one of your interests." },
    });
  }
  return skill.id;
}

/** The session for this request: a new one, or the cursor's (which must be the user's and live). */
async function openSession(user: AuthenticatedActor, query: FeedQuery) {
  if (!query.cursor) {
    const expiresAt = new Date(Date.now() + FEED_CONFIG.sessionHours * 60 * 60 * 1000);
    const session = await insertSession(user.id, query.filter, expiresAt);
    return { id: session.id, filter: query.filter, page: 0 };
  }
  const cursor = decodeCursor(query.cursor, cursorSchema);
  const session = await findSession(cursor.session);
  if (!session || session.userId !== user.id || session.expiresAt <= new Date()) {
    throw new ValidationError("This feed has expired. Refresh to see new posts.", {
      code: "FEED_SESSION_EXPIRED",
    });
  }
  return { id: session.id, filter: session.filter, page: cursor.page };
}

/** GET /api/feed: one page of the user's feed for the filter (or the cursor's session). */
export async function getFeed(
  actor: Actor,
  query: FeedQuery,
  { provider = defaultProvider }: ProviderOption = {},
): Promise<FeedPage> {
  const user = requireSignedIn(actor);
  const profile = await loadProfile(user.id);
  const session = await openSession(user, query);
  const skillId = await resolveSkillFilter(session.filter, profile);

  const since = new Date(Date.now() - FEED_CONFIG.recentSignalDays * DAY_MS);
  const [served, notInterested, savedSkills] = await Promise.all([
    findServedPostIds(session.id),
    findNotInterested(user.id, since),
    getRecentlySavedSkillIds(user.id, since),
  ]);
  const context: RankingContext = {
    interests: new Set(profile.interestIds),
    levels: profile.levels,
    savedSkills,
    notInterestedSkills: new Set(notInterested.recentSkillIds),
    now: new Date(),
  };

  let candidates = await getFeedCandidates({
    excludeIds: [...served, ...notInterested.postIds],
    skillId,
    take: FEED_CONFIG.candidateLimit,
  });
  if (session.filter === "new-to-you") {
    candidates = candidates.filter(
      (candidate) => !candidate.skillIds.some((id) => context.interests.has(id)),
    );
  }

  const page = rankPage(candidates, context, {
    limit: query.limit,
    mode: session.filter === "new-to-you" ? "newToYou" : "full",
    discoveryQuota: session.filter === "for-you",
  });
  const ids = page.map((candidate) => candidate.id);
  await insertImpressions(session.id, ids);
  const cards = await getPostCards(user, ids, { provider });

  const items: FeedPage["items"] = cards.map((post) => ({ kind: "post", post }));
  // FEED-14 (PO decision, P1-21): one suggestion, first item of a For you session's first page.
  if (session.filter === "for-you" && session.page === 0) {
    const suggestion = await pickSuggestion(profile, provider);
    if (suggestion) items.unshift(suggestion);
  }

  return {
    items,
    nextCursor:
      candidates.length > page.length
        ? encodeCursor({ session: session.id, page: session.page + 1 })
        : null,
  };
}

/**
 * The "New to you" skill (FEED-14): an active skill with a pitch that isn't one of the user's
 * interests and has at least one published beginner post; related skills first, then the one
 * with the most quick beginner projects, then by name.
 */
async function pickSuggestion(
  profile: Profile,
  provider: MediaProvider,
): Promise<SkillSuggestion | null> {
  const candidates = await getSuggestionCandidates(profile.interestIds);
  const counts = await getBeginnerProjectCounts(
    candidates.map((candidate) => candidate.skill.id),
    FEED_CONFIG.quickProjectMinutes,
  );
  const [best] = candidates
    .filter((candidate) => (counts.get(candidate.skill.id)?.all ?? 0) > 0)
    .sort(
      (a, b) =>
        Number(b.isRelated) - Number(a.isRelated) ||
        (counts.get(b.skill.id)?.quick ?? 0) - (counts.get(a.skill.id)?.quick ?? 0) ||
        a.skill.name.localeCompare(b.skill.name),
    );
  if (!best) return null;
  return {
    kind: "skill_suggestion",
    skill: best.skill,
    pitch: best.pitch,
    beginnerProjectCount: counts.get(best.skill.id)?.quick ?? 0,
    coverMedia: best.coverMediaId ? await getMedia(best.coverMediaId, { provider }) : null,
  };
}

/** GET /api/feed/suggestion: the same card for the desktop right rail, or null (204). */
export async function getSkillSuggestion(
  actor: Actor,
  { provider = defaultProvider }: ProviderOption = {},
): Promise<SkillSuggestion | null> {
  const user = requireSignedIn(actor);
  return pickSuggestion(await loadProfile(user.id), provider);
}

/** GET /api/feed/filters: For you, up to 5 interests (most recently added first), New to you. */
export async function getFeedFilters(actor: Actor): Promise<FeedFilterChip[]> {
  const user = requireSignedIn(actor);
  const { interestIds } = await loadProfile(user.id);
  const skills = await getActiveSkillSummaries(interestIds);
  const chips = interestIds
    .flatMap((id) => skills.get(id) ?? [])
    .slice(0, FEED_CONFIG.maxInterestChips)
    .map((skill) => ({ key: `skill:${skill.slug}`, label: skill.name }));
  return [
    { key: "for-you", label: "For you" },
    ...chips,
    { key: "new-to-you", label: "New to you" },
  ];
}

/** POST /api/feed/feedback: hides the post for good and weighs down its skills (FEED-05). */
export async function markNotInterested(actor: Actor, input: FeedFeedbackInput): Promise<void> {
  const user = requireSignedIn(actor);
  if (!(await isPostPublished(input.postId))) {
    throw new NotFoundError("We couldn't find that post.");
  }
  await upsertNotInterested(user.id, input.postId);
}

/** DELETE /api/feed/feedback: undo. */
export async function undoNotInterested(actor: Actor, input: FeedFeedbackInput): Promise<void> {
  const user = requireSignedIn(actor);
  await deleteNotInterested(user.id, input.postId);
}
