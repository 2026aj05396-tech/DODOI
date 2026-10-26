import "server-only";

import { z } from "zod";

import type { PostPageQuery } from "@/lib/schemas/posts";
import type { Paginated } from "@/lib/types/api";
import type { Attribution, PostCard, PostDetail, ThemeSummary } from "@/lib/types/posts";
import { mediaProvider as defaultProvider, type MediaProvider } from "@/server/integrations/media";
import type { Actor } from "@/server/lib/actor";
import { NotFoundError, UnauthenticatedError } from "@/server/lib/errors";
import { decodeCursor, encodeCursor } from "@/server/lib/pagination";
import { getSavedPostIds } from "@/server/modules/collections";
import { getActiveSkillSummaries, getSkillBySlug } from "@/server/modules/skills";
import { getCreatorProfiles } from "@/server/modules/users";

import { toMedia } from "./media-service";
import {
  findPostDetail,
  findPublishedCards,
  findPublishedCardsForSkill,
  findPublishedThemeBySlug,
  findPublishedThemes,
  findRelatedCandidates,
  findThemePostIds,
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
  const withCover = rows.filter((row) => row.media[0]);
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
                ? provider.deliveryUrl(creator.avatarPublicId, "image")
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
  const visible = row && (row.status === "PUBLISHED" || actor?.role === "ADMIN");
  if (!row || !visible) throw new NotFoundError("We couldn't find that post.");
  return row;
}

/** GET /api/posts/{postId}: public for published posts; admins can also preview drafts. */
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
