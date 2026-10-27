import "server-only";

import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import type {
  AdminPostListQuery,
  CreateAdminPostInput,
  CreateAdminThemeInput,
  UpdateAdminPostInput,
  UpdateAdminThemeInput,
} from "@/lib/schemas/admin";
import type { AdminPost, AdminPostSummary, AdminTheme } from "@/lib/types/admin";
import type { Paginated } from "@/lib/types/api";
import { db } from "@/server/db/client";
import { mediaProvider as defaultProvider, type MediaProvider } from "@/server/integrations/media";
import { requireAdmin, type Actor } from "@/server/lib/actor";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
  type FieldErrors,
} from "@/server/lib/errors";
import { logger } from "@/server/lib/logger";
import { decodeCursor, encodeCursor } from "@/server/lib/pagination";
import { recordAudit } from "@/server/modules/admin";
import { getSkillStatuses } from "@/server/modules/skills";
import { getUserIdByUsername, getUsernames } from "@/server/modules/users";

import {
  deletePostReturningMedia,
  deleteThemeRow,
  findAdminPost,
  findAdminPostSummaries,
  findAdminTheme,
  findAdminThemes,
  findExistingMediaIds,
  findExistingPostIds,
  findMediaIdsByOwner,
  findPostIdsByAuthor,
  findUnusedMedia,
  insertPost,
  insertTheme,
  replacePostAttribution,
  replacePostMaterials,
  replacePostMedia,
  replacePostSkills,
  replacePostSteps,
  replaceThemePosts,
  setPostStatus,
  updatePostScalars,
  updateThemeScalars,
  type AdminPostRow,
  type AdminThemeRow,
  type PostScalars,
} from "./admin-repository";
import { deleteMediaRow } from "./media-repository";
import { toMedia } from "./media-service";
import { refreshPostSearchIndex } from "./post-service";
import { publishProblems } from "./publish-rules";

// Admin posts and themes (API_SPECIFICATION §8, ADM-04, ADM-06). Admin-only (others 404); every
// change is written together with its audit entry.

type ProviderOption = { provider?: MediaProvider };
type Tx = Prisma.TransactionClient;

const listCursorSchema = z.object({ updatedAt: z.iso.datetime(), id: z.string() });

function notFound(): NotFoundError {
  return new NotFoundError("We couldn't find that post.");
}

function toAdminPost(
  row: AdminPostRow,
  usernames: Map<string, string>,
  provider: MediaProvider,
): AdminPost {
  return {
    id: row.id,
    status: row.status,
    type: row.type,
    title: row.title,
    description: row.description,
    skillIds: row.skills.map((skill) => skill.skillId),
    primarySkillId: row.skills.find((skill) => skill.isPrimary)?.skillId ?? null,
    media: row.media.map((item) => toMedia(item.media, provider)),
    difficulty: row.difficulty,
    estimatedMinutes: row.estimatedMinutes,
    materials: row.materials,
    steps: row.steps.map((step) => ({
      text: step.text,
      mediaId: step.mediaId,
      media: step.media ? toMedia(step.media, provider) : null,
    })),
    attribution:
      row.attribution && row.attribution.sourceType !== "USER_UPLOAD"
        ? { ...row.attribution, sourceType: row.attribution.sourceType }
        : null,
    authorUsername: row.authorId ? (usernames.get(row.authorId) ?? null) : null,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function loadAdminPost(id: string, provider: MediaProvider): Promise<AdminPost> {
  const row = await findAdminPost(id);
  if (!row) throw notFound();
  const usernames = await getUsernames(row.authorId ? [row.authorId] : []);
  return toAdminPost(row, usernames, provider);
}

/** Problems with ids the input refers to (skills, media, author), as field errors. */
async function checkReferences(input: UpdateAdminPostInput): Promise<{
  errors: FieldErrors;
  authorId: string | null | undefined;
}> {
  const errors: FieldErrors = {};

  if (input.skillIds) {
    const statuses = await getSkillStatuses(input.skillIds);
    if (input.skillIds.some((id) => !statuses.has(id)))
      errors.skillIds = "Some skills don't exist.";
  }
  if (input.primarySkillId && input.skillIds && !input.skillIds.includes(input.primarySkillId)) {
    errors.primarySkillId = "The main skill must be one of the post's skills.";
  }

  const mediaIds = [
    ...(input.mediaIds ?? []),
    ...(input.steps ?? []).flatMap((step) => step.mediaId ?? []),
  ];
  if (mediaIds.length > 0) {
    const existing = await findExistingMediaIds(mediaIds);
    if ((input.mediaIds ?? []).some((id) => !existing.has(id))) {
      errors.mediaIds = "Some photos or videos don't exist. Upload them again.";
    }
    if ((input.steps ?? []).some((step) => step.mediaId && !existing.has(step.mediaId))) {
      errors.steps = "Some step photos don't exist. Upload them again.";
    }
  }

  let authorId: string | null | undefined;
  if (input.authorUsername !== undefined) {
    authorId = input.authorUsername ? await getUserIdByUsername(input.authorUsername) : null;
    if (input.authorUsername && !authorId)
      errors.authorUsername = "No dodoi account has that username.";
  }
  return { errors, authorId };
}

/** Writes the given fields and replaces the given lists (admin edits and seed imports). */
export async function applyPostChanges(
  postId: string,
  input: UpdateAdminPostInput,
  authorId: string | null | undefined,
  current: AdminPostRow | null,
  tx: Tx,
) {
  const scalars: Partial<PostScalars> = {
    ...(input.type !== undefined ? { type: input.type } : {}),
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.description !== undefined ? { description: input.description ?? null } : {}),
    ...(input.difficulty !== undefined ? { difficulty: input.difficulty } : {}),
    ...(input.estimatedMinutes !== undefined ? { estimatedMinutes: input.estimatedMinutes } : {}),
    ...(authorId !== undefined ? { authorId } : {}),
  };
  if (Object.keys(scalars).length > 0) await updatePostScalars(postId, scalars, tx);

  if (input.skillIds !== undefined || input.primarySkillId !== undefined) {
    const skillIds = input.skillIds ?? current?.skills.map((skill) => skill.skillId) ?? [];
    const primary =
      input.primarySkillId !== undefined
        ? input.primarySkillId
        : (current?.skills.find((skill) => skill.isPrimary)?.skillId ?? null);
    await replacePostSkills(
      postId,
      skillIds,
      skillIds.includes(primary ?? "") ? primary : null,
      tx,
    );
  }
  if (input.mediaIds !== undefined) await replacePostMedia(postId, input.mediaIds, tx);
  if (input.materials !== undefined) await replacePostMaterials(postId, input.materials, tx);
  if (input.steps !== undefined) await replacePostSteps(postId, input.steps, tx);
  if (input.attribution !== undefined) await replacePostAttribution(postId, input.attribution, tx);
}

/** Throws 400 POST_NOT_PUBLISHABLE with field errors unless the post meets the publish rules. */
export async function assertPublishable(postId: string, tx: Tx): Promise<void> {
  const post = await findAdminPost(postId, tx);
  if (!post) throw notFound();
  const problems = publishProblems({
    skills: post.skills,
    skillStatuses: await getSkillStatuses(post.skills.map((skill) => skill.skillId)),
    media: post.media.map((item) => item.media),
    stepMedia: post.steps.flatMap((step) => step.media ?? []),
    attribution: post.attribution,
    authorId: post.authorId,
  });
  if (Object.keys(problems).length > 0) {
    throw new ValidationError("This post isn't ready to publish yet.", {
      code: "POST_NOT_PUBLISHABLE",
      fields: problems,
    });
  }
}

export async function listAdminPosts(
  actor: Actor,
  query: AdminPostListQuery,
  { provider = defaultProvider }: ProviderOption = {},
): Promise<Paginated<AdminPostSummary>> {
  requireAdmin(actor);
  const after = query.cursor ? decodeCursor(query.cursor, listCursorSchema) : undefined;
  const rows = await findAdminPostSummaries({
    status: query.status,
    skillId: query.skillId,
    sourceType: query.sourceType,
    after: after ? { updatedAt: new Date(after.updatedAt), id: after.id } : undefined,
    take: query.limit + 1,
  });
  const page = rows.slice(0, query.limit);
  const last = page.at(-1);
  return {
    items: page.map((row) => ({
      id: row.id,
      status: row.status,
      type: row.type,
      title: row.title,
      sourceType:
        row.attribution && row.attribution.sourceType !== "USER_UPLOAD"
          ? row.attribution.sourceType
          : null,
      coverMedia: row.media[0] ? toMedia(row.media[0].media, provider) : null,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      updatedAt: row.updatedAt.toISOString(),
    })),
    nextCursor:
      rows.length > query.limit && last
        ? encodeCursor({ updatedAt: last.updatedAt.toISOString(), id: last.id })
        : null,
  };
}

export async function getAdminPost(
  actor: Actor,
  id: string,
  { provider = defaultProvider }: ProviderOption = {},
): Promise<AdminPost> {
  requireAdmin(actor);
  return loadAdminPost(id, provider);
}

/** POST /api/admin/posts: creates a draft (only type and title are required). */
export async function createAdminPost(
  actor: Actor,
  input: CreateAdminPostInput,
  { provider = defaultProvider }: ProviderOption = {},
): Promise<AdminPost> {
  const admin = requireAdmin(actor);
  const { errors, authorId } = await checkReferences(input);
  if (Object.keys(errors).length > 0) throw new ValidationError(undefined, { fields: errors });

  const postId = await db.$transaction(async (tx) => {
    const id = await insertPost(
      {
        type: input.type,
        title: input.title,
        description: input.description ?? null,
        difficulty: input.difficulty,
        estimatedMinutes: input.estimatedMinutes,
        authorId: authorId ?? null,
      },
      tx,
    );
    await applyPostChanges(
      id,
      { ...input, type: undefined, title: undefined },
      undefined,
      null,
      tx,
    );
    await recordAudit(
      { actorId: admin.id, action: "post.create", targetType: "post", targetId: id },
      tx,
    );
    return id;
  });
  await refreshPostSearchIndex(postId);
  return loadAdminPost(postId, provider);
}

/**
 * PATCH /api/admin/posts/{id}. Lists (skills, media, steps, materials) are replaced. A published
 * post must still meet the publish rules after the change, or nothing is saved (PO, P1-16).
 */
export async function updateAdminPost(
  actor: Actor,
  id: string,
  input: UpdateAdminPostInput,
  { provider = defaultProvider }: ProviderOption = {},
): Promise<AdminPost> {
  const admin = requireAdmin(actor);
  const current = await findAdminPost(id);
  if (!current) throw notFound();
  const { errors, authorId } = await checkReferences({
    ...input,
    // The main skill is checked against the post's skills, old or new.
    skillIds: input.skillIds ?? current.skills.map((skill) => skill.skillId),
  });
  if (Object.keys(errors).length > 0) throw new ValidationError(undefined, { fields: errors });

  await db.$transaction(async (tx) => {
    await applyPostChanges(id, input, authorId, current, tx);
    if (current.status === "PUBLISHED") await assertPublishable(id, tx);
    await recordAudit(
      {
        actorId: admin.id,
        action: "post.update",
        targetType: "post",
        targetId: id,
        metadata: { fields: Object.keys(input) },
      },
      tx,
    );
  });
  await refreshPostSearchIndex(id);
  return loadAdminPost(id, provider);
}

/** POST /api/admin/posts/{id}/publish: 400 POST_NOT_PUBLISHABLE with what is missing. */
export async function publishPost(
  actor: Actor,
  id: string,
  { provider = defaultProvider }: ProviderOption = {},
): Promise<AdminPost> {
  const admin = requireAdmin(actor);
  if (!(await findAdminPost(id))) throw notFound();
  await db.$transaction(async (tx) => {
    await assertPublishable(id, tx);
    await setPostStatus(id, "PUBLISHED", tx);
    await recordAudit(
      { actorId: admin.id, action: "post.publish", targetType: "post", targetId: id },
      tx,
    );
  });
  return loadAdminPost(id, provider);
}

/** POST /api/admin/posts/{id}/unpublish: hides the post everywhere until published again. */
export async function unpublishPost(
  actor: Actor,
  id: string,
  { provider = defaultProvider }: ProviderOption = {},
): Promise<AdminPost> {
  const admin = requireAdmin(actor);
  if (!(await findAdminPost(id))) throw notFound();
  await db.$transaction(async (tx) => {
    await setPostStatus(id, "UNPUBLISHED", tx);
    await recordAudit(
      { actorId: admin.id, action: "post.unpublish", targetType: "post", targetId: id },
      tx,
    );
  });
  return loadAdminPost(id, provider);
}

/** DELETE /api/admin/posts/{id}: deletes the post, then its photos and videos used nowhere else. */
export async function deleteAdminPost(
  actor: Actor,
  id: string,
  { provider = defaultProvider }: ProviderOption = {},
): Promise<void> {
  const admin = requireAdmin(actor);
  const mediaIds = await db.$transaction(async (tx) => {
    const used = await deletePostReturningMedia(id, tx);
    await recordAudit(
      { actorId: admin.id, action: "post.delete", targetType: "post", targetId: id },
      tx,
    );
    return used;
  });
  await deleteUnusedMedia(mediaIds, { provider });
}

/**
 * Deletes, from the provider and the database, those of `mediaIds` that nothing uses any more.
 * Failures are logged and left for the daily orphan cleanup (P1-33) to retry.
 */
export async function deleteUnusedMedia(
  mediaIds: string[],
  { provider = defaultProvider }: ProviderOption = {},
): Promise<void> {
  if (mediaIds.length === 0) return;
  for (const media of await findUnusedMedia(mediaIds)) {
    try {
      await provider.deleteAsset(media.publicId, media.type === "VIDEO" ? "video" : "image");
      await deleteMediaRow(media.id);
    } catch (error) {
      logger.error("Could not delete unused media", { mediaId: media.id, error });
    }
  }
}

/**
 * Account hard delete (P1-28, SECURITY_AND_PRIVACY §7.3): deletes every post the user authored
 * (invited creators' seeded posts, PO decision 2026-10-27) inside the caller's transaction.
 * Returns the media those posts used plus the media the user uploaded (avatars), for
 * `deleteUnusedMedia` once the transaction has committed.
 */
export async function deleteContentOfUser(userId: string, tx: Tx): Promise<string[]> {
  const mediaIds = new Set(await findMediaIdsByOwner(userId, tx));
  for (const postId of await findPostIdsByAuthor(userId, tx)) {
    for (const mediaId of await deletePostReturningMedia(postId, tx)) mediaIds.add(mediaId);
    await recordAudit(
      {
        actorId: null,
        action: "post.delete",
        targetType: "post",
        targetId: postId,
        metadata: { reason: "account_deleted" },
      },
      tx,
    );
  }
  return [...mediaIds];
}

// --- Themes ---------------------------------------------------------------------------------

function toAdminTheme(row: AdminThemeRow, provider: MediaProvider): AdminTheme {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    coverMedia: row.coverMedia ? toMedia(row.coverMedia, provider) : null,
    isPublished: row.isPublished,
    position: row.position,
    postIds: row.posts.map((item) => item.postId),
  };
}

async function checkThemeReferences(input: UpdateAdminThemeInput): Promise<void> {
  const errors: FieldErrors = {};
  if (
    input.coverMediaId &&
    !(await findExistingMediaIds([input.coverMediaId])).has(input.coverMediaId)
  ) {
    errors.coverMediaId = "That cover image doesn't exist. Upload it again.";
  }
  if (input.postIds) {
    const existing = await findExistingPostIds(input.postIds);
    if (input.postIds.some((postId) => !existing.has(postId)))
      errors.postIds = "Some posts don't exist.";
  }
  if (Object.keys(errors).length > 0) throw new ValidationError(undefined, { fields: errors });
}

function isSlugTaken(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function slugTaken(): ConflictError {
  return new ConflictError("Another theme already uses that address.", {
    code: "SLUG_TAKEN",
    fields: { slug: "Another theme already uses that address." },
  });
}

async function loadAdminTheme(id: string, provider: MediaProvider): Promise<AdminTheme> {
  const row = await findAdminTheme(id);
  if (!row) throw new NotFoundError("We couldn't find that theme.");
  return toAdminTheme(row, provider);
}

export async function listAdminThemes(
  actor: Actor,
  { provider = defaultProvider }: ProviderOption = {},
): Promise<AdminTheme[]> {
  requireAdmin(actor);
  return (await findAdminThemes()).map((row) => toAdminTheme(row, provider));
}

export async function getAdminTheme(
  actor: Actor,
  id: string,
  { provider = defaultProvider }: ProviderOption = {},
): Promise<AdminTheme> {
  requireAdmin(actor);
  return loadAdminTheme(id, provider);
}

export async function createAdminTheme(
  actor: Actor,
  input: CreateAdminThemeInput,
  { provider = defaultProvider }: ProviderOption = {},
): Promise<AdminTheme> {
  const admin = requireAdmin(actor);
  await checkThemeReferences(input);
  try {
    const id = await db.$transaction(async (tx) => {
      const themeId = await insertTheme(
        {
          slug: input.slug,
          title: input.title,
          description: input.description ?? null,
          coverMediaId: input.coverMediaId ?? null,
          isPublished: input.isPublished,
          position: input.position,
        },
        tx,
      );
      await replaceThemePosts(themeId, input.postIds, tx);
      await recordAudit(
        { actorId: admin.id, action: "theme.create", targetType: "theme", targetId: themeId },
        tx,
      );
      return themeId;
    });
    return loadAdminTheme(id, provider);
  } catch (error) {
    if (isSlugTaken(error)) throw slugTaken();
    throw error;
  }
}

export async function updateAdminTheme(
  actor: Actor,
  id: string,
  input: UpdateAdminThemeInput,
  { provider = defaultProvider }: ProviderOption = {},
): Promise<AdminTheme> {
  const admin = requireAdmin(actor);
  if (!(await findAdminTheme(id))) throw new NotFoundError("We couldn't find that theme.");
  await checkThemeReferences(input);
  const { postIds, description, coverMediaId, ...rest } = input;
  try {
    await db.$transaction(async (tx) => {
      await updateThemeScalars(
        id,
        {
          ...rest,
          ...(description !== undefined ? { description: description ?? null } : {}),
          ...(coverMediaId !== undefined ? { coverMediaId: coverMediaId ?? null } : {}),
        },
        tx,
      );
      if (postIds) await replaceThemePosts(id, postIds, tx);
      await recordAudit(
        {
          actorId: admin.id,
          action: "theme.update",
          targetType: "theme",
          targetId: id,
          metadata: { fields: Object.keys(input) },
        },
        tx,
      );
    });
  } catch (error) {
    if (isSlugTaken(error)) throw slugTaken();
    throw error;
  }
  return loadAdminTheme(id, provider);
}

export async function deleteAdminTheme(actor: Actor, id: string): Promise<void> {
  const admin = requireAdmin(actor);
  await db.$transaction(async (tx) => {
    if (!(await deleteThemeRow(id, tx))) throw new NotFoundError("We couldn't find that theme.");
    await recordAudit(
      { actorId: admin.id, action: "theme.delete", targetType: "theme", targetId: id },
      tx,
    );
  });
}
