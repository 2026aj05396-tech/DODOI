import "server-only";

import { z } from "zod";

import type { ExperienceLevel } from "@/lib/schemas/me";
import type { PostPageQuery } from "@/lib/schemas/posts";
import type { Paginated } from "@/lib/types/api";
import type { Attribution, PostCard, PostDetail, ThemeSummary } from "@/lib/types/posts";
import { mediaProvider as defaultProvider, type MediaProvider } from "@/server/integrations/media";
import type { Actor } from "@/server/lib/actor";
import { NotFoundError, UnauthenticatedError } from "@/server/lib/errors";
import { decodeCursor, encodeCursor } from "@/server/lib/pagination";
import { getSavedPostIds } from "@/server/modules/collections";
import { getActiveSkillSummaries, getSkillBySlug } from "@/server/modules/skills";
import { getBlockedUserIds, getCreatorProfiles } from "@/server/modules/users";

import { avatarUrl, toMedia } from "./media-service";
import {
  countBeginnerPosts,
  countPublishedPostsBySkill,
  findBeginnerPostIds,
  findFeedCandidates,
  findPostDetail,
  findPublishedCards,
  findPublishedCardsForSkill,
  findPublishedThemeBySlug,
  findPublishedThemes,
  findRelatedCandidates,
  findThemePostIds,
  findPostsForModeration,
  findPublishedPostAuthor,
  updatePostHidden,
  findPublishedPostTitles,
  isPublishedPost,
  searchPublishedPostIds,
  updatePostSearchVector,
  type PostCardRow,
} from "./post-repository";

// Post and theme read models (API_SPECIFICATION §5, POST-01…08). Published posts are public
// (OD-29); drafts and unpublished posts are 404 for everyone but admins.

/** PO decision (P1-15): up to 12 related posts. */
export const RELATED_POSTS_LIMIT = 12;
/** How many recent candidates sharing a skill are ranked for "related". */
const RELATED_CANDIDATES = 200;

type ProviderOption = { provider?: MediaProvider };

const skillCursorSchema = z.object({ publishedAt: z.iso.datetime(), id: z.string() });
const offsetCursorSchema = z.object({ offset: z.number().int().min(0) });

function requireSignedIn(actor: Actor): void {
  if (!actor) throw new UnauthenticatedError();
}

function toAttribution(row: PostCardRow["attribution"]): Attribution | null {
  if (!row || row.sourceType === "USER_UPLOAD") return null;
  return { ...row, sourceType: row.sourceType };
}

/** Builds cards with their skills, creators and saved flags, in the order of `rows`. */
async function toCards(
  actor: Actor,
  rows: PostCardRow[],
  provider: MediaProvider,
): Promise<PostCard[]> {
  // People blocked either way never show up (MOD-02).
  const blocked = actor ? await getBlockedUserIds(actor.id) : new Set<string>();
  const withCover = rows.filter(
    (row) => row.media[0] && !(row.authorId && blocked.has(row.authorId)),
  );
  const [skills, creators, saved] = await Promise.all([
    getActiveSkillSummaries([
      ...new Set(withCover.flatMap((row) => row.skills.map((s) => s.skillId))),
    ]),
    getCreatorProfiles([...new Set(withCover.flatMap((row) => row.authorId ?? []))]),
    getSavedPostIds(
      actor,
      withCover.map((row) => row.id),
    ),
  ]);

  return withCover.flatMap((row) => {
    const cover = row.media[0];
    if (!cover) return [];
    const creator = row.authorId ? creators.get(row.authorId) : undefined;
    const primary = row.skills.find((skill) => skill.isPrimary) ?? row.skills[0];
    return [
      {
        id: row.id,
        type: row.type,
        title: row.title,
        estimatedMinutes: row.estimatedMinutes,
        coverMedia: toMedia(cover.media, provider),
        mediaCount: row._count.media,
        skills: row.skills.flatMap((skill) => skills.get(skill.skillId) ?? []),
        primarySkillId: primary?.skillId ?? "",
        creator: creator
          ? {
              username: creator.username,
              displayName: creator.displayName,
              avatarUrl: creator.avatarPublicId
                ? avatarUrl(creator.avatarPublicId, { provider })
                : null,
            }
          : null,
        attribution: toAttribution(row.attribution),
        isSaved: saved.has(row.id),
      },
    ];
  });
}

async function findVisiblePost(actor: Actor, postId: string) {
  const row = await findPostDetail(postId);
  const isAuthor = actor !== null && row?.authorId === actor.id;
  const isModerator = actor?.role === "ADMIN" || actor?.role === "MODERATOR";
  // Admins and the post's own author (CRT-09 Preview) also see drafts; a post hidden after a
  // report stays visible to its author and moderators only (MOD-04).
  const visible =
    row &&
    ((row.status === "PUBLISHED" && (!row.hiddenAt || isAuthor || isModerator)) ||
      actor?.role === "ADMIN" ||
      isAuthor);
  if (!row || !visible) throw new NotFoundError("We couldn't find that post.");
  if (actor && row.authorId && !isAuthor && (await getBlockedUserIds(actor.id)).has(row.authorId)) {
    throw new NotFoundError("We couldn't find that post.");
  }
  return row;
}

/** GET /api/posts/{postId}: public for published posts; admins and authors can preview drafts. */
export async function getPostDetail(
  actor: Actor,
  postId: string,
  { provider = defaultProvider }: ProviderOption = {},
): Promise<PostDetail> {
  const row = await findVisiblePost(actor, postId);
  const [card] = await toCards(actor, [row], provider);
  if (!card) throw new NotFoundError("We couldn't find that post.");
  return {
    ...card,
    description: row.description,
    media: row.media.map((item) => toMedia(item.media, provider)),
    difficulty: row.difficulty,
    materials: row.materials,
    steps: row.steps.map((step) => ({
      position: step.position,
      text: step.text,
      media: step.media ? toMedia(step.media, provider) : null,
    })),
    publishedAt: (row.publishedAt ?? row.createdAt).toISOString(),
    // The maker's own post (not an invited creator's seeded one): Edit instead of Follow (F-17).
    isOwn: actor !== null && row.authorId === actor.id && !row.attribution,
    isPublished: row.status === "PUBLISHED",
    isHidden: row.hiddenAt !== null,
  };
}

/**
 * GET /api/posts/{postId}/related: up to 12 published posts sharing skills, ranked by how many
 * skills they share, then the same primary skill, then newest (PO decision, P1-15).
 */
export async function getRelatedPosts(
  actor: Actor,
  postId: string,
  { provider = defaultProvider }: ProviderOption = {},
): Promise<PostCard[]> {
  const post = await findVisiblePost(actor, postId);
  const skillIds = new Set(post.skills.map((skill) => skill.skillId));
  const primaryId = post.skills.find((skill) => skill.isPrimary)?.skillId;
  if (skillIds.size === 0) return [];

  const candidates = await findRelatedCandidates(postId, [...skillIds], RELATED_CANDIDATES);
  const ranked = candidates
    .map((candidate, newestRank) => ({
      id: candidate.id,
      shared: candidate.skills.filter((skill) => skillIds.has(skill.skillId)).length,
      samePrimary: candidate.skills.some((skill) => skill.isPrimary && skill.skillId === primaryId),
      newestRank,
    }))
    .sort(
      (a, b) =>
        b.shared - a.shared ||
        Number(b.samePrimary) - Number(a.samePrimary) ||
        a.newestRank - b.newestRank,
    )
    .slice(0, RELATED_POSTS_LIMIT);

  return toCards(actor, await findPublishedCards(ranked.map((item) => item.id)), provider);
}

/** GET /api/skills/{slug}/posts: published posts for an active skill, newest first (PO, P1-15). */
export async function listSkillPosts(
  actor: Actor,
  slug: string,
  query: PostPageQuery,
  { provider = defaultProvider }: ProviderOption = {},
): Promise<Paginated<PostCard>> {
  requireSignedIn(actor);
  const skill = await getSkillBySlug(actor, slug);
  const after = query.cursor ? decodeCursor(query.cursor, skillCursorSchema) : undefined;
  const rows = await findPublishedCardsForSkill(skill.id, {
    after: after ? { publishedAt: new Date(after.publishedAt), id: after.id } : undefined,
    take: query.limit + 1,
  });
  const page = rows.slice(0, query.limit);
  const last = page.at(-1);
  return {
    items: await toCards(actor, page, provider),
    nextCursor:
      rows.length > query.limit && last?.publishedAt
        ? encodeCursor({ publishedAt: last.publishedAt.toISOString(), id: last.id })
        : null,
  };
}

function toThemeSummary(
  row: Awaited<ReturnType<typeof findPublishedThemes>>[number],
  provider: MediaProvider,
): ThemeSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    coverMedia: row.coverMedia ? toMedia(row.coverMedia, provider) : null,
    postCount: row._count.posts,
  };
}

/** GET /api/themes: published themes in curated order. */
export async function listThemes(
  actor: Actor,
  { provider = defaultProvider }: ProviderOption = {},
): Promise<ThemeSummary[]> {
  requireSignedIn(actor);
  return (await findPublishedThemes()).map((row) => toThemeSummary(row, provider));
}

/** GET /api/themes/{slug}: the theme and a page of its published posts, in curated order. */
export async function getTheme(
  actor: Actor,
  slug: string,
  query: PostPageQuery,
  { provider = defaultProvider }: ProviderOption = {},
): Promise<{ theme: ThemeSummary; posts: Paginated<PostCard> }> {
  requireSignedIn(actor);
  const theme = await findPublishedThemeBySlug(slug);
  if (!theme) throw new NotFoundError("We couldn't find that theme.");
  const offset = query.cursor ? decodeCursor(query.cursor, offsetCursorSchema).offset : 0;
  const ids = await findThemePostIds(theme.id, offset, query.limit + 1);
  const pageIds = ids.slice(0, query.limit);
  return {
    theme: toThemeSummary(theme, provider),
    posts: {
      items: await toCards(actor, await findPublishedCards(pageIds), provider),
      nextCursor: ids.length > query.limit ? encodeCursor({ offset: offset + query.limit }) : null,
    },
  };
}

/** Keeps search in step with a post's text and skills; the admin editor calls it on save (P1-16). */
export async function refreshPostSearchIndex(postId: string): Promise<void> {
  await updatePostSearchVector(postId);
}

// --- For the feed (P1-21) -------------------------------------------------------------------

export type FeedCandidate = {
  id: string;
  /** Null for team, stock and Creative Commons posts. */
  authorId: string | null;
  publishedAt: Date;
  difficulty: ExperienceLevel | null;
  skillIds: string[];
  primarySkillId: string | null;
};

/** Published posts with a cover, newest first, for the feed to rank. */
export async function getFeedCandidates(options: {
  excludeIds: string[];
  excludeAuthorId?: string;
  excludeAuthorIds?: string[];
  authorIds?: string[];
  skillId?: string;
  take: number;
}): Promise<FeedCandidate[]> {
  const rows = await findFeedCandidates(options);
  return rows.map((row) => ({
    id: row.id,
    authorId: row.authorId,
    publishedAt: row.publishedAt ?? new Date(0),
    difficulty: row.difficulty,
    skillIds: row.skills.map((skill) => skill.skillId),
    primarySkillId: row.skills.find((skill) => skill.isPrimary)?.skillId ?? null,
  }));
}

/** Cards for `ids` in the same order; unpublished posts and posts without media are dropped. */
export async function getPostCards(
  actor: Actor,
  ids: string[],
  { provider = defaultProvider }: ProviderOption = {},
): Promise<PostCard[]> {
  if (ids.length === 0) return [];
  return toCards(actor, await findPublishedCards(ids), provider);
}

/**
 * Beginner projects per skill (FEED-14): published Curious/Beginner posts (`all`) and those
 * taking at most `maxMinutes` (`quick`, the "3 beginner projects under an hour" line).
 */
export async function getBeginnerProjectCounts(
  skillIds: string[],
  maxMinutes: number,
): Promise<Map<string, { all: number; quick: number }>> {
  const counts = new Map<string, { all: number; quick: number }>();
  if (skillIds.length === 0) return counts;
  const { all, quick } = await countBeginnerPosts(skillIds, maxMinutes);
  for (const row of all) counts.set(row.skillId, { all: row._count._all, quick: 0 });
  for (const row of quick) {
    const entry = counts.get(row.skillId);
    if (entry) entry.quick = row._count._all;
  }
  return counts;
}

export async function isPostPublished(id: string): Promise<boolean> {
  return isPublishedPost(id);
}

/** Titles of the published posts among `ids`, keyed by id (notifications). */
export async function getPublishedPostTitles(ids: string[]): Promise<Map<string, string>> {
  const rows = await findPublishedPostTitles([...new Set(ids)]);
  return new Map(rows.map((row) => [row.id, row.title]));
}

/** Who wrote a published post, for comment permissions; null when the post is not published. */
export async function getPublishedPostAuthor(
  id: string,
): Promise<{ authorId: string | null } | null> {
  return findPublishedPostAuthor(id);
}

// --- For search and Explore (P1-23) ------------------------------------------------------------

/** Post ids matching a search, best first (the caller builds cards with `getPostCards`). */
export async function searchPostIds(
  words: string[],
  term: string,
  page: { offset: number; take: number },
): Promise<string[]> {
  return searchPublishedPostIds({ words, term, ...page });
}

/** The newest beginner-friendly posts (Curious or Beginner difficulty). */
export async function getBeginnerPostIds(take: number): Promise<string[]> {
  return findBeginnerPostIds(take);
}

/** Published posts per skill, keyed by skill id. */
export async function getPublishedPostCountsBySkill(): Promise<Map<string, number>> {
  const rows = await countPublishedPostsBySkill();
  return new Map(rows.map((row) => [row.skillId, row._count._all]));
}

/** Posts for the moderation queue, keyed by id (hidden ones included). */
export async function getPostsForModeration(
  ids: string[],
): Promise<Map<string, { title: string; isHidden: boolean; authorId: string | null }>> {
  const rows = await findPostsForModeration([...new Set(ids)]);
  return new Map(
    rows.map((row) => [
      row.id,
      { title: row.title, isHidden: row.hiddenAt !== null, authorId: row.authorId },
    ]),
  );
}

/** Hides or shows a post after a report (MOD-04). The caller checks the moderator and audits. */
export async function setPostHidden(id: string, hidden: boolean): Promise<void> {
  await updatePostHidden(id, hidden);
}
