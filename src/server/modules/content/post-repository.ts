import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db/client";

// Posts and themes (content module tables). Skills, creators and saves are read through their
// own modules by the service.

const mediaSelect = {
  id: true,
  type: true,
  publicId: true,
  width: true,
  height: true,
  altText: true,
  durationSec: true,
} as const;

const cardSelect = {
  id: true,
  type: true,
  title: true,
  estimatedMinutes: true,
  authorId: true,
  publishedAt: true,
  skills: { select: { skillId: true, isPrimary: true } },
  media: { orderBy: { position: "asc" }, take: 1, select: { media: { select: mediaSelect } } },
  _count: { select: { media: true } },
  attribution: {
    select: {
      sourceType: true,
      license: true,
      attributionText: true,
      originalAuthor: true,
      originalUrl: true,
    },
  },
} satisfies Prisma.PostSelect;

export type PostCardRow = Prisma.PostGetPayload<{ select: typeof cardSelect }>;

const detailSelect = {
  ...cardSelect,
  status: true,
  createdAt: true,
  description: true,
  difficulty: true,
  estimatedMinutes: true,
  media: { orderBy: { position: "asc" }, select: { media: { select: mediaSelect } } },
  materials: { orderBy: { position: "asc" }, select: { id: true, name: true, note: true } },
  steps: {
    orderBy: { position: "asc" },
    select: { position: true, text: true, media: { select: mediaSelect } },
  },
} satisfies Prisma.PostSelect;

export type PostDetailRow = Prisma.PostGetPayload<{ select: typeof detailSelect }>;

const PUBLISHED = { status: "PUBLISHED" } as const;

export async function findPostDetail(id: string): Promise<PostDetailRow | null> {
  return db.post.findUnique({ where: { id }, select: detailSelect });
}

/** Cards for `ids`, returned in the same order as `ids`; unpublished posts are dropped. */
export async function findPublishedCards(ids: string[]): Promise<PostCardRow[]> {
  const rows = await db.post.findMany({
    where: { id: { in: ids }, ...PUBLISHED },
    select: cardSelect,
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}

/** Newest first, after the (publishedAt, id) of the previous page's last card. */
export async function findPublishedCardsForSkill(
  skillId: string,
  options: { after?: { publishedAt: Date; id: string }; take: number },
): Promise<PostCardRow[]> {
  const { after, take } = options;
  return db.post.findMany({
    where: {
      ...PUBLISHED,
      skills: { some: { skillId } },
      ...(after
        ? {
            OR: [
              { publishedAt: { lt: after.publishedAt } },
              { publishedAt: after.publishedAt, id: { lt: after.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    take,
    select: cardSelect,
  });
}

/** Published posts sharing at least one of `skillIds`, with their skills, for ranking. */
export async function findRelatedCandidates(postId: string, skillIds: string[], take: number) {
  return db.post.findMany({
    where: { ...PUBLISHED, id: { not: postId }, skills: { some: { skillId: { in: skillIds } } } },
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    take,
    select: { id: true, publishedAt: true, skills: { select: { skillId: true, isPrimary: true } } },
  });
}

/** Published posts for the feed to rank (P1-21), newest first, without `excludeIds`. */
export async function findFeedCandidates(options: {
  excludeIds: string[];
  excludeAuthorId?: string;
  /** Only posts by these authors (the "Following" filter, FLW-04). */
  authorIds?: string[];
  skillId?: string;
  take: number;
}) {
  return db.post.findMany({
    where: {
      ...PUBLISHED,
      ...(options.excludeIds.length > 0 ? { id: { notIn: options.excludeIds } } : {}),
      // Posts without an author (team, stock, Creative Commons) have a null author_id.
      ...(options.excludeAuthorId
        ? { OR: [{ authorId: null }, { authorId: { not: options.excludeAuthorId } }] }
        : {}),
      ...(options.authorIds ? { authorId: { in: options.authorIds } } : {}),
      ...(options.skillId ? { skills: { some: { skillId: options.skillId } } } : {}),
      // Cards need a cover (P1-15); posts without media never reach a page.
      media: { some: {} },
    },
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    take: options.take,
    select: {
      id: true,
      authorId: true,
      publishedAt: true,
      difficulty: true,
      skills: { select: { skillId: true, isPrimary: true } },
    },
  });
}

/** Published beginner posts (Curious or Beginner) per skill, and how many take ≤ `maxMinutes`. */
export async function countBeginnerPosts(skillIds: string[], maxMinutes: number) {
  const where = {
    skillId: { in: skillIds },
    post: { ...PUBLISHED, difficulty: { in: ["CURIOUS" as const, "BEGINNER" as const] } },
  };
  const [all, quick] = await Promise.all([
    db.postSkill.groupBy({ by: ["skillId"], where, _count: { _all: true } }),
    db.postSkill.groupBy({
      by: ["skillId"],
      where: { ...where, post: { ...where.post, estimatedMinutes: { lte: maxMinutes } } },
      _count: { _all: true },
    }),
  ]);
  return { all, quick };
}

export async function isPublishedPost(id: string): Promise<boolean> {
  return (await db.post.count({ where: { id, ...PUBLISHED } })) > 0;
}

/** Titles of the published posts among `ids`. */
export async function findPublishedPostTitles(
  ids: string[],
): Promise<{ id: string; title: string }[]> {
  if (ids.length === 0) return [];
  return db.post.findMany({
    where: { id: { in: ids }, ...PUBLISHED },
    select: { id: true, title: true },
  });
}

/** The author of a published post: `{ authorId: null }` for team posts, null when not published. */
export async function findPublishedPostAuthor(
  id: string,
): Promise<{ authorId: string | null } | null> {
  return db.post.findFirst({ where: { id, ...PUBLISHED }, select: { authorId: true } });
}

const themeSelect = {
  id: true,
  slug: true,
  title: true,
  description: true,
  coverMedia: { select: mediaSelect },
  _count: { select: { posts: { where: { post: PUBLISHED } } } },
} as const;

/** Every published post's type, skill slugs and published theme slugs (seed coverage, OD-31). */
export async function findPublishedPostsForCoverage() {
  return db.post.findMany({
    where: PUBLISHED,
    select: {
      type: true,
      skills: { select: { skill: { select: { slug: true } } } },
      themePosts: {
        where: { theme: { isPublished: true } },
        select: { theme: { select: { slug: true } } },
      },
    },
  });
}

export async function findPublishedThemes() {
  return db.theme.findMany({
    where: { isPublished: true },
    orderBy: [{ position: "asc" }, { title: "asc" }],
    select: themeSelect,
  });
}

export async function findPublishedThemeBySlug(slug: string) {
  return db.theme.findFirst({ where: { slug, isPublished: true }, select: themeSelect });
}

/** Ids of a theme's published posts in curated order, from `offset`. */
export async function findThemePostIds(themeId: string, offset: number, take: number) {
  const rows = await db.themePost.findMany({
    where: { themeId, post: PUBLISHED },
    orderBy: [{ position: "asc" }, { postId: "asc" }],
    skip: offset,
    take,
    select: { postId: true },
  });
  return rows.map((row) => row.postId);
}

/**
 * Rebuilds the post's full-text vector ('simple' config, OD-32): title weight A, description B,
 * skill names C. Called whenever a post or one of its skills' names is saved (P1-16).
 */
export async function updatePostSearchVector(postId: string): Promise<void> {
  await db.$executeRaw`
    UPDATE post SET search_vector =
      setweight(to_tsvector('simple', coalesce(post.title, '')), 'A') ||
      setweight(to_tsvector('simple', coalesce(post.description, '')), 'B') ||
      setweight(to_tsvector('simple', coalesce((
        SELECT string_agg(skill.name, ' ')
        FROM post_skill JOIN skill ON skill.id = post_skill.skill_id
        WHERE post_skill.post_id = post.id
      ), '') || ' ' || coalesce((
        SELECT string_agg(tag.name, ' ')
        FROM post_tag JOIN tag ON tag.id = post_tag.tag_id
        WHERE post_tag.post_id = post.id
      ), '')), 'C')
    WHERE post.id = ${postId}
  `;
}

/**
 * Full-text and typo-tolerant post search (SRCH-01/02, OD-32 `simple`): every word as a prefix
 * ("croch" finds "Crochet") over title, description and skill names, or a title that is similar
 * enough (pg_trgm). Published posts with media, best match first.
 */
export async function searchPublishedPostIds(options: {
  words: string[];
  term: string;
  offset: number;
  take: number;
}): Promise<string[]> {
  const { words, term, offset, take } = options;
  // Words are letters and digits only, so the tsquery syntax can't be injected.
  const prefixQuery = words.map((word) => `${word}:*`).join(" & ");
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT post.id
    FROM post
    WHERE post.status = 'PUBLISHED'
      AND EXISTS (SELECT 1 FROM post_media WHERE post_media.post_id = post.id)
      AND (
        (${prefixQuery} <> '' AND post.search_vector @@ to_tsquery('simple', ${prefixQuery}))
        OR post.title % ${term}
      )
    ORDER BY
      CASE WHEN ${prefixQuery} <> '' THEN ts_rank(post.search_vector, to_tsquery('simple', ${prefixQuery})) ELSE 0 END DESC,
      similarity(post.title, ${term}) DESC,
      post.published_at DESC,
      post.id DESC
    OFFSET ${offset}
    LIMIT ${take}
  `;
  return rows.map((row) => row.id);
}

/** Newest published Curious/Beginner posts with media (Explore, SRCH-05). */
export async function findBeginnerPostIds(take: number): Promise<string[]> {
  const rows = await db.post.findMany({
    where: { ...PUBLISHED, difficulty: { in: ["CURIOUS", "BEGINNER"] }, media: { some: {} } },
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    take,
    select: { id: true },
  });
  return rows.map((row) => row.id);
}

/** Published posts per skill (Explore's "popular" top-up). */
export async function countPublishedPostsBySkill() {
  return db.postSkill.groupBy({
    by: ["skillId"],
    where: { post: PUBLISHED },
    _count: { _all: true },
  });
}
