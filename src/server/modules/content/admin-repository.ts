import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { AttributionInput } from "@/lib/schemas/admin";
import type { ExperienceLevel } from "@/lib/schemas/me";
import type { PostTypeName } from "@/lib/types/posts";
import { db } from "@/server/db/client";

// Admin writes for posts and themes (content module tables).

type Tx = Prisma.TransactionClient;

const mediaSelect = {
  id: true,
  type: true,
  publicId: true,
  width: true,
  height: true,
  altText: true,
  durationSec: true,
} as const;

const adminPostSelect = {
  id: true,
  status: true,
  type: true,
  title: true,
  description: true,
  difficulty: true,
  estimatedMinutes: true,
  authorId: true,
  publishedAt: true,
  updatedAt: true,
  skills: { select: { skillId: true, isPrimary: true } },
  media: { orderBy: { position: "asc" }, select: { media: { select: mediaSelect } } },
  materials: { orderBy: { position: "asc" }, select: { name: true, note: true } },
  steps: {
    orderBy: { position: "asc" },
    select: { text: true, mediaId: true, media: { select: mediaSelect } },
  },
  attribution: {
    select: {
      sourceType: true,
      license: true,
      attributionText: true,
      originalAuthor: true,
      originalUrl: true,
      permissionRef: true,
    },
  },
} satisfies Prisma.PostSelect;

export type AdminPostRow = Prisma.PostGetPayload<{ select: typeof adminPostSelect }>;

export async function findAdminPost(id: string, client: Tx | typeof db = db) {
  return client.post.findUnique({ where: { id }, select: adminPostSelect });
}

export async function findAdminPostSummaries(options: {
  status?: "DRAFT" | "PUBLISHED" | "UNPUBLISHED";
  skillId?: string;
  sourceType?: AttributionInput["sourceType"];
  after?: { updatedAt: Date; id: string };
  take: number;
}) {
  const { status, skillId, sourceType, after, take } = options;
  return db.post.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(skillId ? { skills: { some: { skillId } } } : {}),
      ...(sourceType ? { attribution: { sourceType } } : {}),
      ...(after
        ? {
            OR: [
              { updatedAt: { lt: after.updatedAt } },
              { updatedAt: after.updatedAt, id: { lt: after.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take,
    select: {
      id: true,
      status: true,
      type: true,
      title: true,
      publishedAt: true,
      updatedAt: true,
      attribution: { select: { sourceType: true } },
      media: { orderBy: { position: "asc" }, take: 1, select: { media: { select: mediaSelect } } },
    },
  });
}

export async function findExistingMediaIds(ids: string[]): Promise<Set<string>> {
  const rows = await db.mediaAsset.findMany({ where: { id: { in: ids } }, select: { id: true } });
  return new Set(rows.map((row) => row.id));
}

export async function findExistingPostIds(ids: string[]): Promise<Set<string>> {
  const rows = await db.post.findMany({ where: { id: { in: ids } }, select: { id: true } });
  return new Set(rows.map((row) => row.id));
}

export type PostScalars = {
  type: PostTypeName;
  title: string;
  description: string | null;
  difficulty: ExperienceLevel | null;
  estimatedMinutes: number | null;
  authorId: string | null;
};

export async function insertPost(
  data: PostScalars & { seedKey?: string },
  tx: Tx,
): Promise<string> {
  const post = await tx.post.create({ data: { ...data, status: "DRAFT" }, select: { id: true } });
  return post.id;
}

export async function updatePostScalars(id: string, data: Partial<PostScalars>, tx: Tx) {
  await tx.post.update({ where: { id }, data });
}

export async function replacePostSkills(
  postId: string,
  skillIds: string[],
  primarySkillId: string | null,
  tx: Tx,
) {
  await tx.postSkill.deleteMany({ where: { postId } });
  await tx.postSkill.createMany({
    data: skillIds.map((skillId) => ({ postId, skillId, isPrimary: skillId === primarySkillId })),
  });
}

export async function replacePostMedia(postId: string, mediaIds: string[], tx: Tx) {
  await tx.postMedia.deleteMany({ where: { postId } });
  await tx.postMedia.createMany({
    data: mediaIds.map((mediaId, position) => ({ postId, mediaId, position })),
  });
}

/** Replacing materials gives them new ids, which resets anyone's ticked materials (P1-20b). */
/**
 * Replaces the materials. A material whose name is unchanged keeps its id, so users' ticks
 * (`PostProgress.checkedMaterialIds`, P1-20b) survive admin edits and seed re-imports.
 */
export async function replacePostMaterials(
  postId: string,
  materials: { name: string; note?: string | null }[],
  tx: Tx,
) {
  const existing = await tx.postMaterial.findMany({
    where: { postId },
    orderBy: { position: "asc" },
    select: { id: true, name: true },
  });
  const unused = [...existing];
  const keptIds = materials.map((material) => {
    const index = unused.findIndex((row) => row.name === material.name);
    return index === -1 ? null : (unused.splice(index, 1)[0]?.id ?? null);
  });

  await tx.postMaterial.deleteMany({
    where: { postId, id: { notIn: keptIds.filter((id) => id !== null) } },
  });
  // Positions are unique per post: move kept rows out of the way before renumbering.
  await tx.postMaterial.updateMany({
    where: { postId },
    data: { position: { increment: 10_000 } },
  });
  for (const [position, material] of materials.entries()) {
    const id = keptIds[position];
    const data = { position, name: material.name, note: material.note ?? null };
    if (id) await tx.postMaterial.update({ where: { id }, data });
    else await tx.postMaterial.create({ data: { postId, ...data } });
  }
}

export async function replacePostSteps(
  postId: string,
  steps: { text: string; mediaId?: string | null }[],
  tx: Tx,
) {
  await tx.postStep.deleteMany({ where: { postId } });
  await tx.postStep.createMany({
    data: steps.map((step, position) => ({
      postId,
      position,
      text: step.text,
      mediaId: step.mediaId ?? null,
    })),
  });
}

export async function replacePostAttribution(
  postId: string,
  attribution: AttributionInput | null,
  tx: Tx,
) {
  if (!attribution) {
    await tx.postAttribution.deleteMany({ where: { postId } });
    return;
  }
  const data = {
    sourceType: attribution.sourceType,
    license: attribution.license,
    attributionText: attribution.attributionText,
    originalAuthor: attribution.originalAuthor ?? null,
    originalUrl: attribution.originalUrl ?? null,
    permissionRef: attribution.permissionRef ?? null,
  };
  await tx.postAttribution.upsert({ where: { postId }, create: { postId, ...data }, update: data });
}

export async function setPostStatus(
  id: string,
  status: "PUBLISHED" | "UNPUBLISHED",
  tx: Tx,
): Promise<void> {
  if (status === "PUBLISHED") {
    const post = await tx.post.findUniqueOrThrow({ where: { id }, select: { publishedAt: true } });
    await tx.post.update({
      where: { id },
      // The first publication time is kept when a post is published again.
      data: { status, publishedAt: post.publishedAt ?? new Date() },
    });
    return;
  }
  await tx.post.update({ where: { id }, data: { status } });
}

/** A seeded post by its stable key (P1-18). */
export async function findPostIdBySeedKey(seedKey: string, tx: Tx): Promise<string | null> {
  const post = await tx.post.findUnique({ where: { seedKey }, select: { id: true } });
  return post?.id ?? null;
}

/** Deletes the post and returns the media it used (post media and step images). */
export async function deletePostReturningMedia(id: string, tx: Tx): Promise<string[]> {
  const post = await tx.post.findUnique({
    where: { id },
    select: { media: { select: { mediaId: true } }, steps: { select: { mediaId: true } } },
  });
  if (!post) return [];
  await tx.post.delete({ where: { id } });
  return [
    ...new Set([
      ...post.media.map((item) => item.mediaId),
      ...post.steps.flatMap((step) => step.mediaId ?? []),
    ]),
  ];
}

/** Of `ids`, the media no longer used anywhere (posts, steps, avatars, covers). */
export async function findUnusedMedia(ids: string[]) {
  return db.mediaAsset.findMany({
    where: {
      id: { in: ids },
      postMedia: { none: {} },
      stepMedia: { none: {} },
      profileAvatar: null,
      skillCovers: { none: {} },
      themeCovers: { none: {} },
    },
    select: { id: true, type: true, publicId: true },
  });
}

const adminThemeSelect = {
  id: true,
  slug: true,
  title: true,
  description: true,
  isPublished: true,
  position: true,
  coverMedia: { select: mediaSelect },
  posts: { orderBy: { position: "asc" }, select: { postId: true } },
} satisfies Prisma.ThemeSelect;

export type AdminThemeRow = Prisma.ThemeGetPayload<{ select: typeof adminThemeSelect }>;

export async function findAdminThemes() {
  return db.theme.findMany({
    orderBy: [{ position: "asc" }, { title: "asc" }],
    select: adminThemeSelect,
  });
}

export async function findAdminTheme(id: string, client: Tx | typeof db = db) {
  return client.theme.findUnique({ where: { id }, select: adminThemeSelect });
}

export type ThemeScalars = {
  slug: string;
  title: string;
  description: string | null;
  coverMediaId: string | null;
  isPublished: boolean;
  position: number;
};

export async function insertTheme(data: ThemeScalars, tx: Tx): Promise<string> {
  return (await tx.theme.create({ data, select: { id: true } })).id;
}

export async function updateThemeScalars(id: string, data: Partial<ThemeScalars>, tx: Tx) {
  await tx.theme.update({ where: { id }, data });
}

export async function replaceThemePosts(themeId: string, postIds: string[], tx: Tx) {
  await tx.themePost.deleteMany({ where: { themeId } });
  await tx.themePost.createMany({
    data: postIds.map((postId, position) => ({ themeId, postId, position })),
  });
}

export async function deleteThemeRow(id: string, tx: Tx): Promise<boolean> {
  const { count } = await tx.theme.deleteMany({ where: { id } });
  return count > 0;
}
