import "server-only";

import type {
  MediaPurpose,
  RegisterMediaInput,
  SignMediaInput,
  UpdateMediaInput,
} from "@/lib/schemas/media";
import type { Media, SignedUpload } from "@/lib/types/media";
import {
  mediaProvider as defaultProvider,
  type MediaProvider,
  type ResourceType,
} from "@/server/integrations/media";
import type { Actor, AuthenticatedActor } from "@/server/lib/actor";
import { serverEnv } from "@/server/lib/env";
import {
  ConflictError,
  NotFoundError,
  PayloadTooLargeError,
  ValidationError,
  type AppError,
} from "@/server/lib/errors";
import { logger } from "@/server/lib/logger";
import { enforceRateLimit, type RateLimitRule } from "@/server/lib/rate-limit";

import {
  deleteMediaRow,
  findMediaById,
  findMediaByIds,
  findOwnImage,
  findMediaWithOwner,
  findOrphanedMedia,
  insertMedia,
  mediaExistsForPublicId,
  updateMediaAltText,
  type MediaRow,
} from "./media-repository";
import {
  checkDeclaredUpload,
  checkUploadedAsset,
  limitsFor,
  type MediaProblem,
} from "./media-rules";
import { canEditMedia, canUploadMedia } from "./policies";

// Media pipeline (SYSTEM_ARCHITECTURE §8, SECURITY_AND_PRIVACY §5): sign → the browser uploads
// straight to Cloudinary → register, which re-checks Cloudinary's metadata and deletes files that
// break the rules (MEDIA-05).

/** SECURITY_AND_PRIVACY §6: media signing, 30 per hour per user. */
export const MEDIA_SIGN_RATE_LIMIT: RateLimitRule = {
  name: "media-sign-user",
  limit: 30,
  windowSeconds: 60 * 60,
};

/** Media never attached to anything is deleted after 24 hours (CONFIRMED retention). */
export const ORPHAN_MEDIA_AGE_MS = 24 * 60 * 60 * 1000;

type ProviderOption = { provider?: MediaProvider };

const FOLDER_BY_PURPOSE: Record<MediaPurpose, string> = {
  post: "posts",
  cover: "covers",
  avatar: "avatars",
  entry: "entries",
  ai: "ai",
};

/** Everything dodoi stores lives under `dodoi/<APP_ENV>/`, so environments never mix. */
export function mediaFolder(purpose: MediaPurpose): string {
  return `dodoi/${serverEnv.APP_ENV}/${FOLDER_BY_PURPOSE[purpose]}`;
}

function resourceTypeOf(type: "IMAGE" | "VIDEO"): ResourceType {
  return type === "VIDEO" ? "video" : "image";
}

/** Avatars, post media and journal photos: any signed-in user; covers: admins (others: 404, §3). */
function requireUploader(actor: Actor, purpose: MediaPurpose): AuthenticatedActor {
  if (!actor || !canUploadMedia(actor, purpose)) throw new NotFoundError();
  return actor;
}

function toError(problem: MediaProblem): AppError {
  if (problem.kind === "size") return new PayloadTooLargeError(problem.message);
  if (problem.kind === "type") {
    return new ValidationError(problem.message, { code: "UNSUPPORTED_MEDIA_TYPE" });
  }
  return new ValidationError(problem.message, { code: "MEDIA_REJECTED" });
}

/** Widths offered in `srcSet` (P1-31): phones at 1x–3x up to a full-width desktop gallery. */
const RESPONSIVE_WIDTHS = [320, 640, 960, 1280, 1920];
/** Avatars are shown at most 128 CSS pixels wide; 256 covers 2x screens. */
const AVATAR_WIDTH = 256;

/** `srcSet` for a stored still: each width below the original, then the original (≤ 1920px). */
function stillSrcSet(row: MediaRow, provider: MediaProvider): string {
  const largest = Math.min(row.width, RESPONSIVE_WIDTHS.at(-1) ?? row.width);
  const widths = [...RESPONSIVE_WIDTHS.filter((width) => width < largest), largest];
  const urlFor = (width: number) =>
    row.type === "VIDEO"
      ? provider.posterUrl(row.publicId, { width })
      : provider.deliveryUrl(row.publicId, "image", { width });
  return widths.map((width) => `${urlFor(width)} ${width}w`).join(", ");
}

export function toMedia(row: MediaRow, provider: MediaProvider = defaultProvider): Media {
  const resourceType = resourceTypeOf(row.type);
  const media: Media = {
    id: row.id,
    type: row.type,
    url: provider.deliveryUrl(row.publicId, resourceType),
    width: row.width,
    height: row.height,
    altText: row.altText,
    srcSet: stillSrcSet(row, provider),
  };
  if (row.type === "VIDEO") {
    media.posterUrl = provider.posterUrl(row.publicId);
    if (row.durationSec !== null) media.durationSec = row.durationSec;
  }
  return media;
}

/** POST /api/media/sign: checks the declared file, then signs a direct upload to its folder. */
export async function signMediaUpload(
  actor: Actor,
  input: SignMediaInput,
  { provider = defaultProvider }: ProviderOption = {},
): Promise<SignedUpload> {
  const manager = requireUploader(actor, input.purpose);
  await enforceRateLimit(MEDIA_SIGN_RATE_LIMIT, manager.id);

  const problem = checkDeclaredUpload(input.purpose, input.type, input);
  const limits = limitsFor(input.purpose, input.type);
  if (problem || !limits) throw toError(problem ?? { kind: "type", message: "Not allowed." });

  return provider.signUpload({
    folder: mediaFolder(input.purpose),
    resourceType: resourceTypeOf(input.type),
    allowedFormats: limits.formats.join(","),
  });
}

/**
 * POST /api/media: registers an uploaded file after checking Cloudinary's own metadata. A file
 * that breaks the rules is deleted from Cloudinary.
 */
export async function registerMedia(
  actor: Actor,
  input: RegisterMediaInput,
  { provider = defaultProvider }: ProviderOption = {},
): Promise<Media> {
  const manager = requireUploader(actor, input.purpose);
  const resourceType = resourceTypeOf(input.type);

  // Only files in the folder we signed for can be registered (not other uploads in the account).
  if (!input.publicId.startsWith(`${mediaFolder(input.purpose)}/`)) {
    throw new ValidationError("That upload doesn't belong here.", { code: "MEDIA_NOT_FOUND" });
  }
  // Alt text can be added after uploading; publishing a post requires it (publish rules).
  const altText = input.altText || null;
  if (await mediaExistsForPublicId(input.publicId)) {
    throw new ConflictError("That upload is already saved.", { code: "MEDIA_ALREADY_REGISTERED" });
  }

  const asset = await provider.getAsset(input.publicId, resourceType);
  if (!asset) {
    throw new ValidationError("We couldn't find that upload. Please upload it again.", {
      code: "MEDIA_NOT_FOUND",
    });
  }
  const problem = checkUploadedAsset(input.purpose, input.type, asset);
  if (problem) {
    await provider.deleteAsset(asset.publicId, resourceType);
    logger.info("Deleted an upload that broke the media rules", {
      publicId: asset.publicId,
      problem: problem.kind,
    });
    throw toError(problem);
  }

  const row = await insertMedia({
    ownerId: manager.id,
    type: input.type,
    publicId: asset.publicId,
    format: asset.format,
    width: asset.width,
    height: asset.height,
    bytes: asset.bytes,
    durationSec: asset.durationSec,
    altText,
  });
  return toMedia(row, provider);
}

/** PATCH /api/media/{id}: alt text, by the uploader or an admin (others get 404, §3). */
export async function updateMedia(
  actor: Actor,
  id: string,
  input: UpdateMediaInput,
  { provider = defaultProvider }: ProviderOption = {},
): Promise<Media> {
  const row = await findMediaWithOwner(id);
  if (!row || !canEditMedia(actor, row.ownerId)) throw new NotFoundError();
  return toMedia(await updateMediaAltText(id, input.altText), provider);
}

/**
 * Deletes media that was uploaded but never attached to a post, step, avatar or cover within 24
 * hours (orphan tracking; run by the daily jobs, P1-33). Returns how many were removed.
 */
export async function deleteOrphanedMedia({
  provider = defaultProvider,
  now = new Date(),
}: ProviderOption & { now?: Date } = {}): Promise<number> {
  const orphans = await findOrphanedMedia(new Date(now.getTime() - ORPHAN_MEDIA_AGE_MS));
  for (const orphan of orphans) {
    await provider.deleteAsset(orphan.publicId, resourceTypeOf(orphan.type));
    await deleteMediaRow(orphan.id);
  }
  if (orphans.length > 0) logger.info("Deleted orphaned media", { count: orphans.length });
  return orphans.length;
}

/** One media item as the API shows it, or null (e.g. a skill's cover for the admin editor). */
export async function getMedia(
  id: string,
  { provider = defaultProvider }: ProviderOption = {},
): Promise<Media | null> {
  const row = await findMediaById(id);
  return row ? toMedia(row, provider) : null;
}

/**
 * The actor's own uploaded avatar, for setting it on their profile (P1-12): it must exist, belong
 * to them, be an image and sit in the avatars folder. Throws a field error otherwise.
 */
export async function getOwnAvatar(
  actor: AuthenticatedActor,
  mediaId: string,
  { provider = defaultProvider }: ProviderOption = {},
): Promise<Media> {
  const row = await findMediaWithOwner(mediaId);
  const isOwnAvatar =
    row &&
    row.ownerId === actor.id &&
    row.type === "IMAGE" &&
    row.publicId.startsWith(`${mediaFolder("avatar")}/`);
  if (!isOwnAvatar) {
    throw new ValidationError(undefined, {
      fields: { avatarMediaId: "That photo isn't available. Upload it again." },
    });
  }
  return toMedia(row, provider);
}

/** Media by id, as the API shows it (journal entries and other modules' own lists). */
export async function getMediaMap(
  ids: string[],
  { provider = defaultProvider }: ProviderOption = {},
): Promise<Map<string, Media>> {
  const rows = await findMediaByIds([...new Set(ids)]);
  return new Map(rows.map((row) => [row.id, toMedia(row, provider)]));
}

/** Of `ids`, the media `ownerId` uploaded (others may only attach their own photos). */
export async function getOwnedMediaIds(ownerId: string, ids: string[]): Promise<Set<string>> {
  const rows = await findMediaByIds([...new Set(ids)], ownerId);
  return new Set(rows.map((row) => row.id));
}

const MIME_BY_FORMAT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

/**
 * A photo the user uploaded, scaled down for the AI provider (P4-01), or null when it is not an
 * image of theirs. Only the delivery URL and MIME type leave this module.
 */
export async function getOwnImageForAI(
  ownerId: string,
  mediaId: string,
  { width, provider = defaultProvider }: ProviderOption & { width: number },
): Promise<{ url: string; mimeType: string } | null> {
  const row = await findOwnImage(mediaId, ownerId);
  if (!row) return null;
  const mimeType = MIME_BY_FORMAT[row.format.toLowerCase()];
  if (!mimeType) return null;
  return { url: provider.deliveryUrl(row.publicId, "image", { width }), mimeType };
}

/** Delivery URL for a stored avatar (profiles and creator rows), scaled for its small slot. */
export function avatarUrl(publicId: string, { provider = defaultProvider }: ProviderOption = {}) {
  return provider.deliveryUrl(publicId, "image", { width: AVATAR_WIDTH });
}
