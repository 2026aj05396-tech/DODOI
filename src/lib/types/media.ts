// Media as returned by the API (API_SPECIFICATION §2).

export type Media = {
  id: string;
  type: "IMAGE" | "VIDEO";
  /** Base delivery URL (auto format and quality; metadata such as EXIF/location stripped). */
  url: string;
  width: number;
  height: number;
  altText: string | null;
  /** Video only: a still from the first frame. */
  posterUrl?: string;
  /**
   * Smaller copies of the still (the image, or a video's poster) for `<img srcSet>`: widths from
   * 320px up to the original's, at most 1920px. Pair it with `sizes` for the slot it fills.
   */
  srcSet: string;
  /** Video only. */
  durationSec?: number;
};

/** What the browser needs for a signed, direct upload to Cloudinary. */
export type SignedUpload = {
  uploadUrl: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  resourceType: "image" | "video";
  /** Must be sent with the upload exactly as signed. */
  allowedFormats: string;
};
