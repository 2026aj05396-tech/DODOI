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

const themeSelect = {
  id: true,
  slug: true,
  title: true,
  description: true,
  coverMedia: { select: mediaSelect },
} as const;

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
      ), '')), 'C')
    WHERE post.id = ${postId}
  `;
}
