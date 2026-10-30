import "server-only";

import type { MediaType } from "@/generated/prisma/client";
import { db } from "@/server/db/client";

const mediaSelect = {
  id: true,
  type: true,
  publicId: true,
  width: true,
  height: true,
  altText: true,
  durationSec: true,
} as const;

export type MediaRow = {
  id: string;
  type: MediaType;
  publicId: string;
  width: number;
  height: number;
  altText: string | null;
  durationSec: number | null;
};

export async function findMediaById(id: string): Promise<MediaRow | null> {
  return db.mediaAsset.findUnique({ where: { id }, select: mediaSelect });
}

/** An image the owner uploaded, with the format the provider reports (photos sent to the AI). */
export async function findOwnImage(id: string, ownerId: string) {
  return db.mediaAsset.findFirst({
    where: { id, ownerId, type: "IMAGE" },
    select: { publicId: true, format: true },
  });
}

/** Media rows by id; with `ownerId`, only those that user uploaded. */
export async function findMediaByIds(ids: string[], ownerId?: string): Promise<MediaRow[]> {
  if (ids.length === 0) return [];
  return db.mediaAsset.findMany({
    where: { id: { in: ids }, ...(ownerId ? { ownerId } : {}) },
    select: mediaSelect,
  });
}

export async function findMediaByPublicId(publicId: string): Promise<MediaRow | null> {
  return db.mediaAsset.findUnique({ where: { publicId }, select: mediaSelect });
}

export async function findMediaWithOwner(id: string) {
  return db.mediaAsset.findUnique({ where: { id }, select: { ...mediaSelect, ownerId: true } });
}

export async function mediaExistsForPublicId(publicId: string): Promise<boolean> {
  return (await db.mediaAsset.count({ where: { publicId } })) > 0;
}

export async function insertMedia(data: {
  /** Null for seed imports (no signed-in uploader). */
  ownerId: string | null;
  type: MediaType;
  publicId: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
  durationSec: number | null;
  altText: string | null;
}): Promise<MediaRow> {
  return db.mediaAsset.create({ data, select: mediaSelect });
}

export async function updateMediaAltText(id: string, altText: string): Promise<MediaRow> {
  return db.mediaAsset.update({ where: { id }, data: { altText }, select: mediaSelect });
}

/** Media used nowhere (no post, step, avatar or cover) and older than `cutoff`. */
export async function findOrphanedMedia(cutoff: Date) {
  return db.mediaAsset.findMany({
    where: {
      createdAt: { lt: cutoff },
      postMedia: { none: {} },
      stepMedia: { none: {} },
      profileAvatar: null,
      skillCovers: { none: {} },
      themeCovers: { none: {} },
      // Journal entry photos (P2-03) live on the media table's relation too.
      entryMedia: { none: {} },
      // Photos sent to the companion (P4-01) stay until their conversation goes.
      aiMessages: { none: {} },
      // Photos on help requests (P3-03) go with their request.
      helpMedia: { none: {} },
    },
    select: { id: true, type: true, publicId: true },
  });
}

export async function deleteMediaRow(id: string): Promise<void> {
  await db.mediaAsset.deleteMany({ where: { id } });
}
