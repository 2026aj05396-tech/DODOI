import { z } from "zod";

// API contracts for media (API_SPECIFICATION §7). Limits: PRODUCT_REQUIREMENTS MEDIA-01…05.

/**
 * What an upload is for. Decides the Cloudinary folder and the limits:
 * post = post images and videos, cover = skill/theme covers, avatar = profile photos (P1-12),
 * entry = journal progress-entry photos (P2-01, used from P2-03), ai = a photo sent to the
 * companion (P4-01, images only, removed with its conversation), help = a photo on a help request (P3-03, images only, removed with the request), community = a photo in a community discussion (P3-01, images only, removed with the post).
 */
export const mediaPurposeSchema = z.enum([
  "post",
  "cover",
  "avatar",
  "entry",
  "ai",
  "help",
  "community",
]);
export type MediaPurpose = z.output<typeof mediaPurposeSchema>;

export const mediaTypeSchema = z.enum(["IMAGE", "VIDEO"]);
export type MediaTypeName = z.output<typeof mediaTypeSchema>;

export const signMediaSchema = z.object({
  purpose: mediaPurposeSchema,
  type: mediaTypeSchema,
  /** Size the browser reports for the file; re-checked against Cloudinary after upload. */
  bytes: z.number().int().positive(),
  mimeType: z.string().min(1).max(100),
});
export type SignMediaInput = z.output<typeof signMediaSchema>;

export const ALT_TEXT_MAX_LENGTH = 300;

/**
 * Below this many pixels on the shortest side a photo may look soft on large screens. Not a limit
 * (PO decision 2026-10-29): such photos upload normally and only get a friendly note.
 */
export const SHARP_IMAGE_MIN_SIDE = 600;

export const registerMediaSchema = z.object({
  purpose: mediaPurposeSchema,
  type: mediaTypeSchema,
  publicId: z.string().min(1).max(255),
  altText: z.string().trim().max(ALT_TEXT_MAX_LENGTH).optional(),
});
export type RegisterMediaInput = z.output<typeof registerMediaSchema>;

export const updateMediaSchema = z.object({
  altText: z.string().trim().min(1, "Describe the image.").max(ALT_TEXT_MAX_LENGTH),
});
export type UpdateMediaInput = z.output<typeof updateMediaSchema>;

export const mediaIdParamsSchema = z.object({ id: z.string().min(1).max(40) });
