import "server-only";

import type { CollectionVisibility } from "@/generated/prisma/client";
import { db } from "@/server/db/client";

const PUBLISHED_POST = { post: { status: "PUBLISHED" as const } };

export async function findSavedPostIds(userId: string, postIds: string[]): Promise<string[]> {
  const rows = await db.save.findMany({
    where: { userId, postId: { in: postIds } },
    select: { postId: true },
  });
  return rows.map((row) => row.postId);
}

/** Skill ids of the posts the user saved since `since` (one entry per save and skill). */
export async function findSavedSkillIdsSince(userId: string, since: Date): Promise<string[]> {
  const saves = await db.save.findMany({
    where: { userId, createdAt: { gte: since } },
    select: { post: { select: { skills: { select: { skillId: true } } } } },
  });
  return saves.flatMap((save) => save.post.skills.map((skill) => skill.skillId));
}

// --- Saves -----------------------------------------------------------------------------------

export async function upsertSave(userId: string, postId: string) {
  return db.save.upsert({
    where: { userId_postId: { userId, postId } },
    create: { userId, postId },
    update: {},
    select: { id: true },
  });
}

/** Unsave; its collection items go with it (cascade), so it leaves every collection. */
export async function deleteSave(userId: string, postId: string): Promise<void> {
  await db.save.deleteMany({ where: { userId, postId } });
}

/** "All saved": newest first, after the previous page's last save. */
export async function findSavesPage(
  userId: string,
  options: { after?: { createdAt: Date; id: string }; take: number },
) {
  const { after, take } = options;
  return db.save.findMany({
    where: {
      userId,
      ...PUBLISHED_POST,
      ...(after
        ? {
            OR: [
              { createdAt: { lt: after.createdAt } },
              { createdAt: after.createdAt, id: { lt: after.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
    select: { id: true, postId: true, createdAt: true },
  });
}

// --- Collections -----------------------------------------------------------------------------

export async function countCollections(userId: string): Promise<number> {
  return db.collection.count({ where: { userId } });
}

export async function insertCollection(data: {
  userId: string;
  name: string;
  nameNormalized: string;
  visibility: CollectionVisibility;
}) {
  return db.collection.create({ data, select: { id: true } });
}

export async function findCollection(id: string) {
  return db.collection.findUnique({
    where: { id },
    select: { id: true, userId: true, name: true, visibility: true },
  });
}

/** One collection or all of a user's, most recently changed first, with published-post counts. */
export async function findCollectionSummaries(where: { userId: string } | { id: string }) {
  return db.collection.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      name: true,
      visibility: true,
      _count: { select: { items: { where: { save: PUBLISHED_POST } } } },
      items: {
        where: { save: PUBLISHED_POST },
        orderBy: [{ addedAt: "desc" }, { saveId: "desc" }],
        take: 3,
        select: { save: { select: { postId: true } } },
      },
    },
  });
}

export async function updateCollectionRow(
  id: string,
  data: { name?: string; nameNormalized?: string; visibility?: CollectionVisibility },
): Promise<void> {
  await db.collection.update({ where: { id }, data });
}

export async function deleteCollectionRow(id: string): Promise<void> {
  await db.collection.deleteMany({ where: { id } });
}

/** Adding or removing posts counts as a change for "recently changed first". */
export async function touchCollection(id: string): Promise<void> {
  await db.collection.update({ where: { id }, data: { updatedAt: new Date() } });
}

export async function countItems(collectionId: string): Promise<number> {
  return db.collectionItem.count({ where: { collectionId } });
}

export async function insertItem(collectionId: string, saveId: string): Promise<void> {
  await db.collectionItem.createMany({ data: [{ collectionId, saveId }], skipDuplicates: true });
}

export async function deleteItem(
  collectionId: string,
  userId: string,
  postId: string,
): Promise<void> {
  await db.collectionItem.deleteMany({ where: { collectionId, save: { userId, postId } } });
}

/** A collection's published posts, most recently added first, after the previous page's last. */
export async function findItemsPage(
  collectionId: string,
  options: { after?: { addedAt: Date; saveId: string }; take: number },
) {
  const { after, take } = options;
  return db.collectionItem.findMany({
    where: {
      collectionId,
      save: PUBLISHED_POST,
      ...(after
        ? {
            OR: [
              { addedAt: { lt: after.addedAt } },
              { addedAt: after.addedAt, saveId: { lt: after.saveId } },
            ],
          }
        : {}),
    },
    orderBy: [{ addedAt: "desc" }, { saveId: "desc" }],
    take,
    select: { saveId: true, addedAt: true, save: { select: { postId: true } } },
  });
}

export async function findCollectionIdsWithPost(userId: string, postId: string): Promise<string[]> {
  const rows = await db.collectionItem.findMany({
    where: { save: { userId, postId } },
    select: { collectionId: true },
  });
  return rows.map((row) => row.collectionId);
}
