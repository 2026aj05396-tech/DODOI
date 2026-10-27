import "server-only";

import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import {
  MAX_COLLECTION_ITEMS,
  MAX_COLLECTIONS,
  type CreateCollectionInput,
  type ListPageQuery,
  type UpdateCollectionInput,
} from "@/lib/schemas/collections";
import type { CollectionVisibility } from "@/lib/types/collections";
import type { Actor, AuthenticatedActor } from "@/server/lib/actor";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthenticatedError,
  UnprocessableError,
} from "@/server/lib/errors";
import { decodeCursor, encodeCursor } from "@/server/lib/pagination";
import { getPublicProfile } from "@/server/modules/users";

import {
  countCollections,
  countItems,
  countSavesBySkillSince,
  deleteCollectionRow,
  deleteItem,
  deleteSave,
  findCollection,
  findCollectionIdsWithPost,
  findCollectionSummaries,
  findItemsPage,
  findSavedPostIds,
  findSavedSkillIdsSince,
  findSavesPage,
  insertCollection,
  insertItem,
  touchCollection,
  updateCollectionRow,
  upsertSave,
} from "./repository";

// Saves and collections (COLL-01…07, OD-17, API_SPECIFICATION §6). This module works with post
// ids; the `library` module turns them into post cards (content imports this module, so it can't
// import content back). Whether a post is published is checked by the caller through
// `isPublished`, for the same reason.

const savesCursorSchema = z.object({ createdAt: z.iso.datetime(), id: z.string() });
const itemsCursorSchema = z.object({ addedAt: z.iso.datetime(), saveId: z.string() });

function requireSignedIn(actor: Actor): AuthenticatedActor {
  if (!actor) throw new UnauthenticatedError();
  return actor;
}

function collectionNotFound(): NotFoundError {
  return new NotFoundError("We couldn't find that collection.");
}

/** Case-insensitive uniqueness per user (OD-17): trimmed, spaces collapsed, lowercased. */
export function normalizeCollectionName(name: string): string {
  return name.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

function nameTaken(): ConflictError {
  return new ConflictError("You already have a collection with that name.", {
    code: "COLLECTION_NAME_TAKEN",
    fields: { name: "You already have a collection with that name." },
  });
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** Public collections are a public action, so they need a verified email (OD-08). */
function assertMayPublish(user: AuthenticatedActor, visibility: CollectionVisibility | undefined) {
  if (visibility === "PUBLIC" && !user.isEmailVerified) {
    throw new ForbiddenError("Verify your email to share a collection.", {
      code: "EMAIL_NOT_VERIFIED",
    });
  }
}

/** The collection if the actor owns it; others get 404 (never reveal private collections). */
async function loadOwnCollection(user: AuthenticatedActor, id: string) {
  const collection = await findCollection(id);
  if (!collection || collection.userId !== user.id) throw collectionNotFound();
  return collection;
}

type PublishedCheck = (postId: string) => Promise<boolean>;

// --- Saves -----------------------------------------------------------------------------------

/** Which of `postIds` the actor has saved; always empty when signed out (OD-29). */
export async function getSavedPostIds(actor: Actor, postIds: string[]): Promise<Set<string>> {
  if (!actor || postIds.length === 0) return new Set();
  return new Set(await findSavedPostIds(actor.id, postIds));
}

/** Skills of the posts the user saved since `since`, for the feed's save affinity (P1-21). */
export async function getRecentlySavedSkillIds(userId: string, since: Date): Promise<Set<string>> {
  return new Set(await findSavedSkillIdsSince(userId, since));
}

/** PUT /api/saves/{postId}: idempotent; the post must be published. */
export async function savePost(
  actor: Actor,
  postId: string,
  isPublished: PublishedCheck,
): Promise<{ saved: true; saveId: string }> {
  const user = requireSignedIn(actor);
  if (!(await isPublished(postId))) throw new NotFoundError("We couldn't find that post.");
  const save = await upsertSave(user.id, postId);
  return { saved: true, saveId: save.id };
}

/** DELETE /api/saves/{postId}: idempotent; the post leaves every collection too. */
export async function unsavePost(actor: Actor, postId: string): Promise<void> {
  const user = requireSignedIn(actor);
  await deleteSave(user.id, postId);
}

/** "All saved" (GET /api/saves): post ids, most recently saved first. */
export async function listSavedPostIds(
  actor: Actor,
  query: ListPageQuery,
): Promise<{ postIds: string[]; nextCursor: string | null }> {
  const user = requireSignedIn(actor);
  const after = query.cursor ? decodeCursor(query.cursor, savesCursorSchema) : undefined;
  const rows = await findSavesPage(user.id, {
    after: after ? { createdAt: new Date(after.createdAt), id: after.id } : undefined,
    take: query.limit + 1,
  });
  const page = rows.slice(0, query.limit);
  const last = page.at(-1);
  return {
    postIds: page.map((row) => row.postId),
    nextCursor:
      rows.length > query.limit && last
        ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
        : null,
  };
}

// --- Collections -----------------------------------------------------------------------------

export type CollectionRow = {
  id: string;
  name: string;
  visibility: CollectionVisibility;
  itemCount: number;
  /** Up to 3 most recently added published posts, newest first, for the cover mosaic (`1i`). */
  previewPostIds: string[];
};

function toRow(row: Awaited<ReturnType<typeof findCollectionSummaries>>[number]): CollectionRow {
  return {
    id: row.id,
    name: row.name,
    visibility: row.visibility,
    itemCount: row._count.items,
    previewPostIds: row.items.map((item) => item.save.postId),
  };
}

/** GET /api/collections: the actor's collections, most recently changed first. */
export async function listMyCollections(actor: Actor): Promise<CollectionRow[]> {
  const user = requireSignedIn(actor);
  return (await findCollectionSummaries({ userId: user.id })).map(toRow);
}

/**
 * A user's public collections, most recently changed first, for their profile (PRF-07). The
 * caller decides whether the profile may be seen (private profiles hide them, OD-10).
 */
export async function listPublicCollections(ownerId: string): Promise<CollectionRow[]> {
  return (await findCollectionSummaries({ userId: ownerId, visibility: "PUBLIC" })).map(toRow);
}

/** POST /api/collections (max 100 per user, unique names). */
export async function createCollection(
  actor: Actor,
  input: CreateCollectionInput,
): Promise<CollectionRow> {
  const user = requireSignedIn(actor);
  assertMayPublish(user, input.visibility);
  if ((await countCollections(user.id)) >= MAX_COLLECTIONS) {
    throw new UnprocessableError(`You can have up to ${MAX_COLLECTIONS} collections.`, {
      code: "COLLECTION_LIMIT_REACHED",
    });
  }
  try {
    const { id } = await insertCollection({
      userId: user.id,
      name: input.name,
      nameNormalized: normalizeCollectionName(input.name),
      visibility: input.visibility,
    });
    return { id, name: input.name, visibility: input.visibility, itemCount: 0, previewPostIds: [] };
  } catch (error) {
    if (isUniqueViolation(error)) throw nameTaken();
    throw error;
  }
}

/**
 * GET /api/collections/{id}: the owner always; other signed-in users only when it is public and
 * the owner's profile may be shown (OD-10). Otherwise 404.
 */
export async function getCollectionPage(
  actor: Actor,
  id: string,
  query: ListPageQuery,
): Promise<{
  collection: CollectionRow & {
    isOwner: boolean;
    owner: { username: string; displayName: string } | null;
  };
  postIds: string[];
  nextCursor: string | null;
}> {
  const user = requireSignedIn(actor);
  const collection = await findCollection(id);
  if (!collection) throw collectionNotFound();
  const isOwner = collection.userId === user.id;
  const owner = isOwner ? null : await getPublicProfile(collection.userId);
  if (!isOwner && (collection.visibility !== "PUBLIC" || !owner)) throw collectionNotFound();

  const after = query.cursor ? decodeCursor(query.cursor, itemsCursorSchema) : undefined;
  const [summary, rows] = await Promise.all([
    findCollectionSummaries({ id }),
    findItemsPage(id, {
      after: after ? { addedAt: new Date(after.addedAt), saveId: after.saveId } : undefined,
      take: query.limit + 1,
    }),
  ]);
  const [row] = summary;
  if (!row) throw collectionNotFound();
  const page = rows.slice(0, query.limit);
  const last = page.at(-1);
  return {
    collection: { ...toRow(row), isOwner, owner },
    postIds: page.map((item) => item.save.postId),
    nextCursor:
      rows.length > query.limit && last
        ? encodeCursor({ addedAt: last.addedAt.toISOString(), saveId: last.saveId })
        : null,
  };
}

/** PATCH /api/collections/{id}: rename and/or change visibility (owner only). */
export async function updateCollection(
  actor: Actor,
  id: string,
  input: UpdateCollectionInput,
): Promise<CollectionRow> {
  const user = requireSignedIn(actor);
  await loadOwnCollection(user, id);
  assertMayPublish(user, input.visibility);
  try {
    await updateCollectionRow(id, {
      ...(input.name !== undefined
        ? { name: input.name, nameNormalized: normalizeCollectionName(input.name) }
        : {}),
      ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw nameTaken();
    throw error;
  }
  const [row] = await findCollectionSummaries({ id });
  if (!row) throw collectionNotFound();
  return toRow(row);
}

/** DELETE /api/collections/{id}: the collection only; its posts stay saved (CONFIRMED). */
export async function deleteCollection(actor: Actor, id: string): Promise<void> {
  const user = requireSignedIn(actor);
  await loadOwnCollection(user, id);
  await deleteCollectionRow(id);
}

/**
 * PUT /api/collections/{id}/items/{postId}: saves the post first if needed (PO decision, P1-24),
 * then adds it (idempotent; max 1,000 per collection).
 */
export async function addToCollection(
  actor: Actor,
  id: string,
  postId: string,
  isPublished: PublishedCheck,
): Promise<void> {
  const user = requireSignedIn(actor);
  await loadOwnCollection(user, id);
  if (!(await isPublished(postId))) throw new NotFoundError("We couldn't find that post.");
  if ((await countItems(id)) >= MAX_COLLECTION_ITEMS) {
    throw new UnprocessableError(
      `A collection can hold up to ${MAX_COLLECTION_ITEMS.toLocaleString("en-IN")} posts.`,
      { code: "COLLECTION_FULL" },
    );
  }
  const save = await upsertSave(user.id, postId);
  await insertItem(id, save.id);
  await touchCollection(id);
}

/** DELETE /api/collections/{id}/items/{postId}: this collection only; the save remains. */
export async function removeFromCollection(
  actor: Actor,
  id: string,
  postId: string,
): Promise<void> {
  const user = requireSignedIn(actor);
  await loadOwnCollection(user, id);
  await deleteItem(id, user.id, postId);
  await touchCollection(id);
}

/** GET /api/posts/{postId}/collections: the actor's collections holding the post (picker). */
export async function getCollectionIdsForPost(actor: Actor, postId: string): Promise<string[]> {
  const user = requireSignedIn(actor);
  return findCollectionIdsWithPost(user.id, postId);
}

/** How often each skill's posts were saved since `since` (Explore's "popular", P1-23). */
export async function getSaveCountsBySkill(since: Date): Promise<Map<string, number>> {
  const rows = await countSavesBySkillSince(since);
  return new Map(rows.map((row) => [row.skillId, Number(row.saves)]));
}
