import "server-only";

import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import type {
  CreateOwnPostInput,
  OwnPostListQuery,
  PostPageQuery,
  PublishOwnPostInput,
  UpdateOwnPostInput,
} from "@/lib/schemas/posts";
import { TAG_MAX_LENGTH, TAG_MIN_LENGTH } from "@/lib/schemas/posts";
import type { Paginated } from "@/lib/types/api";
import type { OwnPost, OwnPostSummary, PostCard } from "@/lib/types/posts";
import { db } from "@/server/db/client";
import { mediaProvider as defaultProvider, type MediaProvider } from "@/server/integrations/media";
import type { Actor, AuthenticatedActor } from "@/server/lib/actor";
import {
  ForbiddenError,
  NotFoundError,
  UnauthenticatedError,
  UnprocessableError,
  ValidationError,
  type FieldErrors,
} from "@/server/lib/errors";
import { decodeCursor, encodeCursor } from "@/server/lib/pagination";
import { enforceRateLimit, type RateLimitRule } from "@/server/lib/rate-limit";
import { containsOffensiveWords, getSkillStatuses } from "@/server/modules/skills";
import { getProfileForView } from "@/server/modules/users";

import {
  deletePostReturningMedia,
  findAdminPost,
  insertPost,
  setPostStatus,
  type AdminPostRow,
} from "./admin-repository";
import { applyPostChanges, deleteUnusedMedia } from "./admin-service";
import { toMedia } from "./media-service";
import {
  countDrafts,
  findOwnedMediaIds,
  findOwnPostSummaries,
  findPostOwnership,
  findPostTagNames,
  findPublishedPostIdsByAuthor,
  replacePostTags,
  setPostProject,
  setOwnWorkConfirmed,
} from "./own-post-repository";
import { getPostCards, refreshPostSearchIndex } from "./post-service";
import { ownPostProblems } from "./publish-rules";

// Makers' own posts (P2-02; PRODUCT_REQUIREMENTS CRT-01…13, API_SPECIFICATION §9.1). Any
// signed-in user writes drafts; publishing needs a verified email (OD-08). Other people's posts,
// and seeded posts of invited creators, answer 404.

type ProviderOption = { provider?: MediaProvider };
type Tx = Prisma.TransactionClient;

/** CRT-13: 20 published posts a day per user. */
export const OWN_POST_PUBLISH_RATE_LIMIT: RateLimitRule = {
  name: "own-post-publish",
  limit: 20,
  windowSeconds: 24 * 60 * 60,
};

/** CRT-13: at most 50 drafts per user. */
export const MAX_DRAFTS = 50;

const listCursorSchema = z.object({ updatedAt: z.iso.datetime(), id: z.string() });
const profileCursorSchema = z.object({ publishedAt: z.iso.datetime(), id: z.string() });

/** Letters and marks of any script, digits, spaces and dashes (like skill names, OD-13). */
const ALLOWED_TAG = /^[\p{L}\p{M}\p{N} -]+$/u;

function requireSignedIn(actor: Actor): AuthenticatedActor {
  if (!actor) throw new UnauthenticatedError();
  return actor;
}

function notFound(): NotFoundError {
  return new NotFoundError("We couldn't find that post.");
}

/** Throws 404 unless `id` is a post the actor wrote themselves. */
async function requireOwnPost(actor: AuthenticatedActor, id: string) {
  const post = await findPostOwnership(id);
  if (!post || post.authorId !== actor.id || post.attribution) throw notFound();
  return post;
}

/** "#Crochet  Tips" → "crochet tips" (display) and its comparison key. */
export function toTag(raw: string): { name: string; normalizedName: string } | null {
  const name = raw
    .normalize("NFKC")
    .replace(/^#+/u, "")
    .trim()
    .replace(/\s+/gu, " ")
    .toLocaleLowerCase("en");
  const length = [...name].length;
  if (length < TAG_MIN_LENGTH || length > TAG_MAX_LENGTH || !ALLOWED_TAG.test(name)) return null;
  return { name, normalizedName: name };
}

/** Field errors for the tags (CRT-06), or the tags to store, without duplicates. */
function checkTags(raw: string[]): {
  tags: { name: string; normalizedName: string }[];
  error?: string;
} {
  const tags = new Map<string, { name: string; normalizedName: string }>();
  for (const value of raw) {
    const tag = toTag(value);
    if (!tag) {
      return {
        tags: [],
        error: `Tags are ${TAG_MIN_LENGTH}–${TAG_MAX_LENGTH} letters, numbers, spaces or dashes.`,
      };
    }
    if (containsOffensiveWords(tag.name)) return { tags: [], error: "Please choose another tag." };
    tags.set(tag.normalizedName, tag);
  }
  return { tags: [...tags.values()] };
}

/** Skills must be active (CRT-05); photos and videos must be the maker's own uploads. */
async function checkReferences(
  actor: AuthenticatedActor,
  input: UpdateOwnPostInput,
  currentSkillIds: string[],
): Promise<FieldErrors> {
  const errors: FieldErrors = {};
  const skillIds = input.skillIds ?? currentSkillIds;

  if (input.skillIds) {
    const statuses = await getSkillStatuses(input.skillIds);
    if (input.skillIds.some((id) => statuses.get(id) !== "ACTIVE")) {
      errors.skillIds = "Some skills aren't available. Choose others.";
    }
  }
  if (input.primarySkillId && !skillIds.includes(input.primarySkillId)) {
    errors.primarySkillId = "The main skill must be one of the post's skills.";
  }

  const stepMediaIds = (input.steps ?? []).flatMap((step) => step.mediaId ?? []);
  const mediaIds = [...(input.mediaIds ?? []), ...stepMediaIds];
  if (mediaIds.length > 0) {
    const owned = await findOwnedMediaIds(mediaIds, actor.id);
    if ((input.mediaIds ?? []).some((id) => !owned.has(id))) {
      errors.mediaIds = "Some photos or videos aren't available. Upload them again.";
    }
    if (stepMediaIds.some((id) => !owned.has(id))) {
      errors.steps = "Some step photos aren't available. Upload them again.";
    }
  }

  if (input.tags) {
    const { error } = checkTags(input.tags);
    if (error) errors.tags = error;
  }
  return errors;
}

function toOwnPost(
  row: AdminPostRow,
  tags: string[],
  ownWorkConfirmed: boolean,
  provider: MediaProvider,
): OwnPost {
  return {
    id: row.id,
    status: row.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
    type: row.type,
    title: row.title,
    description: row.description,
    skillIds: row.skills.map((skill) => skill.skillId),
    primarySkillId: row.skills.find((skill) => skill.isPrimary)?.skillId ?? null,
    media: row.media.map((item) => toMedia(item.media, provider)),
    tags,
    difficulty: row.difficulty,
    estimatedMinutes: row.estimatedMinutes,
    materials: row.materials,
    steps: row.steps.map((step) => ({
      text: step.text,
      mediaId: step.mediaId,
      media: step.media ? toMedia(step.media, provider) : null,
    })),
    ownWorkConfirmed,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function loadOwnPost(id: string, provider: MediaProvider): Promise<OwnPost> {
  const [row, tags, ownership] = await Promise.all([
    findAdminPost(id),
    findPostTagNames(id),
    findPostOwnership(id),
  ]);
  if (!row || !ownership) throw notFound();
  return toOwnPost(row, tags, ownership.ownWorkConfirmedAt !== null, provider);
}

/** Throws 400 POST_NOT_PUBLISHABLE with field errors unless the own-post rules are met. */
async function assertOwnPublishable(postId: string, ownWorkConfirmed: boolean, tx: Tx) {
  const post = await findAdminPost(postId, tx);
  if (!post) throw notFound();
  const problems = ownPostProblems({
    type: post.type,
    skills: post.skills,
    skillStatuses: await getSkillStatuses(post.skills.map((skill) => skill.skillId)),
    media: post.media.map((item) => item.media),
    stepMedia: post.steps.flatMap((step) => step.media ?? []),
    stepCount: post.steps.length,
    estimatedMinutes: post.estimatedMinutes,
    ownWorkConfirmed,
  });
  if (Object.keys(problems).length > 0) {
    throw new ValidationError("This post isn't ready to post yet.", {
      code: "POST_NOT_PUBLISHABLE",
      fields: problems,
    });
  }
}

/** Writes everything but the tags through the admin helper, then the tags. */
async function writeChanges(
  postId: string,
  input: UpdateOwnPostInput,
  current: AdminPostRow | null,
  tx: Tx,
) {
  const { tags, ...fields } = input;
  await applyPostChanges(postId, fields, undefined, current, tx);
  if (tags !== undefined) await replacePostTags(postId, checkTags(tags).tags, tx);
}

/** GET /api/me/posts: the maker's drafts and posts, last changed first. */
export async function listOwnPosts(
  actor: Actor,
  query: OwnPostListQuery,
  { provider = defaultProvider }: ProviderOption = {},
): Promise<Paginated<OwnPostSummary>> {
  const user = requireSignedIn(actor);
  const after = query.cursor ? decodeCursor(query.cursor, listCursorSchema) : undefined;
  const rows = await findOwnPostSummaries({
    authorId: user.id,
    status: query.status,
    after: after ? { updatedAt: new Date(after.updatedAt), id: after.id } : undefined,
    take: query.limit + 1,
  });
  const page = rows.slice(0, query.limit);
  const last = page.at(-1);
  return {
    items: page.map((row) => ({
      id: row.id,
      status: row.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
      type: row.type,
      title: row.title,
      coverMedia: row.media[0] ? toMedia(row.media[0].media, provider) : null,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      updatedAt: row.updatedAt.toISOString(),
      isHidden: row.hiddenAt !== null,
    })),
    nextCursor:
      rows.length > query.limit && last
        ? encodeCursor({ updatedAt: last.updatedAt.toISOString(), id: last.id })
        : null,
  };
}

/**
 * POST /api/me/posts: a new draft (F-17 creates it with the first upload). `projectId` must already
 * be checked as the caller's (the route asks the journal module).
 */
export async function createOwnPost(
  actor: Actor,
  input: CreateOwnPostInput,
  { provider = defaultProvider }: ProviderOption = {},
): Promise<OwnPost> {
  const user = requireSignedIn(actor);
  if ((await countDrafts(user.id)) >= MAX_DRAFTS) {
    throw new UnprocessableError(
      `You have ${MAX_DRAFTS} drafts. Post or delete some to start another.`,
      { code: "DRAFT_LIMIT" },
    );
  }
  const errors = await checkReferences(user, input, []);
  if (Object.keys(errors).length > 0) throw new ValidationError(undefined, { fields: errors });

  const postId = await db.$transaction(async (tx) => {
    const id = await insertPost(
      {
        type: input.type,
        title: input.title,
        description: input.description ?? null,
        difficulty: input.difficulty,
        estimatedMinutes: input.estimatedMinutes,
        authorId: user.id,
      },
      tx,
    );
    const { projectId, ...fields } = input;
    await writeChanges(id, { ...fields, type: undefined, title: undefined }, null, tx);
    if (projectId) await setPostProject(id, projectId, tx);
    return id;
  });
  await refreshPostSearchIndex(postId);
  return loadOwnPost(postId, provider);
}

/** GET /api/me/posts/{id}: the full editable post. */
export async function getOwnPost(
  actor: Actor,
  id: string,
  { provider = defaultProvider }: ProviderOption = {},
): Promise<OwnPost> {
  await requireOwnPost(requireSignedIn(actor), id);
  return loadOwnPost(id, provider);
}

/**
 * PATCH /api/me/posts/{id}. Lists are replaced. A published post changes live (CRT-10), so it must
 * still meet the publish rules after the change, or nothing is saved.
 */
export async function updateOwnPost(
  actor: Actor,
  id: string,
  input: UpdateOwnPostInput,
  { provider = defaultProvider }: ProviderOption = {},
): Promise<OwnPost> {
  const user = requireSignedIn(actor);
  const ownership = await requireOwnPost(user, id);
  const current = await findAdminPost(id);
  if (!current) throw notFound();
  const errors = await checkReferences(
    user,
    input,
    current.skills.map((skill) => skill.skillId),
  );
  if (Object.keys(errors).length > 0) throw new ValidationError(undefined, { fields: errors });

  await db.$transaction(async (tx) => {
    await writeChanges(id, input, current, tx);
    if (current.status === "PUBLISHED") {
      await assertOwnPublishable(id, ownership.ownWorkConfirmedAt !== null, tx);
    }
  });
  await refreshPostSearchIndex(id);
  return loadOwnPost(id, provider);
}

/**
 * POST /api/me/posts/{id}/publish ("Share"): verified email (OD-08), the own-work confirmation the
 * first time (CRT-08), the own-post rules, and 20 a day. Sharing a published post again is a no-op.
 */
export async function publishOwnPost(
  actor: Actor,
  id: string,
  input: PublishOwnPostInput,
  { provider = defaultProvider }: ProviderOption = {},
): Promise<OwnPost> {
  const user = requireSignedIn(actor);
  const ownership = await requireOwnPost(user, id);
  if (!user.isEmailVerified) {
    throw new ForbiddenError("Verify your email to post.", { code: "EMAIL_NOT_VERIFIED" });
  }
  const current = await findAdminPost(id);
  if (current?.status === "PUBLISHED") return loadOwnPost(id, provider);
  await enforceRateLimit(OWN_POST_PUBLISH_RATE_LIMIT, user.id);

  const confirmed = ownership.ownWorkConfirmedAt !== null || input.ownWorkConfirmed;
  await db.$transaction(async (tx) => {
    await assertOwnPublishable(id, confirmed, tx);
    if (!ownership.ownWorkConfirmedAt) await setOwnWorkConfirmed(id, tx);
    await setPostStatus(id, "PUBLISHED", tx);
  });
  return loadOwnPost(id, provider);
}

/** DELETE /api/me/posts/{id} (CRT-11): the post, its saves, and its media used nowhere else. */
export async function deleteOwnPost(
  actor: Actor,
  id: string,
  { provider = defaultProvider }: ProviderOption = {},
): Promise<void> {
  await requireOwnPost(requireSignedIn(actor), id);
  const mediaIds = await db.$transaction((tx) => deletePostReturningMedia(id, tx));
  await deleteUnusedMedia(mediaIds, { provider });
}

/**
 * GET /api/profiles/{username}/posts: the profile's published posts, newest first (Posts tab).
 * Private profiles show none to others (OD-10); hidden or deleted profiles answer 404.
 */
export async function listProfilePosts(
  actor: Actor,
  username: string,
  query: PostPageQuery,
  { provider = defaultProvider }: ProviderOption = {},
): Promise<Paginated<PostCard>> {
  const profile = await getProfileForView(actor, username);
  if (profile.isPrivate) return { items: [], nextCursor: null };
  const after = query.cursor ? decodeCursor(query.cursor, profileCursorSchema) : undefined;
  const rows = await findPublishedPostIdsByAuthor({
    authorId: profile.userId,
    after: after ? { publishedAt: new Date(after.publishedAt), id: after.id } : undefined,
    take: query.limit + 1,
  });
  const page = rows.slice(0, query.limit);
  const last = page.at(-1);
  return {
    items: await getPostCards(
      actor,
      page.map((row) => row.id),
      { provider },
    ),
    nextCursor:
      rows.length > query.limit && last?.publishedAt
        ? encodeCursor({ publishedAt: last.publishedAt.toISOString(), id: last.id })
        : null,
  };
}
