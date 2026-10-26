import { z } from "zod";

// API contracts for media (API_SPECIFICATION §7). Limits: PRODUCT_REQUIREMENTS MEDIA-01…05.

/**
 * What an upload is for. Decides the Cloudinary folder and the limits:
 * post = post images and videos, cover = skill/theme covers, avatar = profile photos (P1-12).
 */
export const mediaPurposeSchema = z.enum(["post", "cover", "avatar"]);
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
