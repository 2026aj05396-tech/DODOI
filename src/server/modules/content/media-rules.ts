import type { MediaPurpose, MediaTypeName } from "@/lib/schemas/media";

// Upload limits (PRODUCT_REQUIREMENTS MEDIA-01…03). Checked twice (MEDIA-05): against what the
// browser declares when asking for a signature, and against Cloudinary's own metadata afterwards.

const MB = 1024 * 1024;

type Limits = {
  maxBytes: number;
  /** Cloudinary format names accepted (also enforced by Cloudinary through `allowed_formats`). */
  formats: readonly string[];
  mimeTypes: readonly string[];
  /** Shortest side, images only. */
  minShortestSide?: number;
  /** Videos only. */
  maxDurationSec?: number;
};

const IMAGE_FORMATS = ["jpg", "png", "webp", "heic"] as const;
const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const VIDEO_FORMATS = ["mp4", "mov", "webm"] as const;
const VIDEO_MIME_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

/** Content images: MEDIA-01. Avatars: MEDIA-02. Videos (posts only): MEDIA-03. */
export function limitsFor(purpose: MediaPurpose, type: MediaTypeName): Limits | null {
  if (type === "VIDEO") {
    if (purpose !== "post") return null;
    return {
      maxBytes: 50 * MB,
      formats: VIDEO_FORMATS,
      mimeTypes: VIDEO_MIME_TYPES,
      maxDurationSec: 60,
    };
  }
  if (purpose === "avatar") {
    return { maxBytes: 5 * MB, formats: IMAGE_FORMATS, mimeTypes: IMAGE_MIME_TYPES };
  }
  return {
    maxBytes: 10 * MB,
    formats: IMAGE_FORMATS,
    mimeTypes: IMAGE_MIME_TYPES,
    minShortestSide: 600,
  };
}

export type MediaProblem =
  | { kind: "type"; message: string }
  | { kind: "size"; message: string }
  | { kind: "dimensions"; message: string }
  | { kind: "duration"; message: string };

const TYPE_MESSAGE = {
  IMAGE: "Use a JPEG, PNG, WebP or HEIC image.",
  VIDEO: "Use an MP4, MOV or WebM video.",
} as const;

function sizeMessage(maxBytes: number): string {
  return `That file is too large. The limit is ${maxBytes / MB} MB.`;
}

/** Checks what the browser says about a file before signing (fast feedback, not trusted). */
export function checkDeclaredUpload(
  purpose: MediaPurpose,
  type: MediaTypeName,
  declared: { bytes: number; mimeType: string },
): MediaProblem | null {
  const limits = limitsFor(purpose, type);
  if (!limits) return { kind: "type", message: "Videos can only be added to posts." };
  if (!limits.mimeTypes.includes(declared.mimeType.toLowerCase())) {
    return { kind: "type", message: TYPE_MESSAGE[type] };
  }
  if (declared.bytes > limits.maxBytes)
    return { kind: "size", message: sizeMessage(limits.maxBytes) };
  return null;
}

export type UploadedAsset = {
  resourceType: string;
  format: string;
  bytes: number;
  width: number;
  height: number;
  durationSec: number | null;
};

/** Checks the uploaded file using Cloudinary's metadata (MEDIA-05). */
export function checkUploadedAsset(
  purpose: MediaPurpose,
  type: MediaTypeName,
  asset: UploadedAsset,
): MediaProblem | null {
  const limits = limitsFor(purpose, type);
  const expectedResource = type === "VIDEO" ? "video" : "image";
  if (
    !limits ||
    asset.resourceType !== expectedResource ||
    !limits.formats.includes(asset.format)
  ) {
    return { kind: "type", message: TYPE_MESSAGE[type] };
  }
  if (asset.bytes > limits.maxBytes) return { kind: "size", message: sizeMessage(limits.maxBytes) };
  if (limits.minShortestSide && Math.min(asset.width, asset.height) < limits.minShortestSide) {
    return {
      kind: "dimensions",
      message: `That image is too small. The shortest side needs at least ${limits.minShortestSide} px.`,
    };
  }
  if (limits.maxDurationSec !== undefined) {
    if (asset.durationSec === null || asset.durationSec > limits.maxDurationSec) {
      return {
        kind: "duration",
        message: `That video is too long. Keep it to ${limits.maxDurationSec} seconds or less.`,
      };
    }
  }
  return null;
}
