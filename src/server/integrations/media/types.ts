// Media provider contract (SYSTEM_ARCHITECTURE §4, §8). Modules depend on this, never on
// Cloudinary directly, so tests can pass a fake.

export type ResourceType = "image" | "video";

export type SignUploadParams = {
  folder: string;
  resourceType: ResourceType;
  /** Comma-separated format names the provider must refuse to store otherwise. */
  allowedFormats: string;
};

export type SignedUploadParams = {
  uploadUrl: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  resourceType: ResourceType;
  allowedFormats: string;
};

/** A server-side upload (seed importer): the file is stored under exactly this public id. */
export type UploadFileParams = {
  file: Blob;
  /** Used for the format check and error messages, e.g. "bee-1.jpg". */
  fileName: string;
  publicId: string;
  resourceType: ResourceType;
  allowedFormats: string;
};

/** Metadata the provider reports for a stored file (trusted, unlike the browser's claims). */
export type ProviderAsset = {
  publicId: string;
  resourceType: ResourceType;
  format: string;
  bytes: number;
  width: number;
  height: number;
  durationSec: number | null;
};

export interface MediaProvider {
  signUpload(params: SignUploadParams): SignedUploadParams;
  /** Uploads from the server and returns the provider's metadata for the stored file. */
  uploadFile(params: UploadFileParams): Promise<ProviderAsset>;
  /** Null when no such file exists. */
  getAsset(publicId: string, resourceType: ResourceType): Promise<ProviderAsset | null>;
  deleteAsset(publicId: string, resourceType: ResourceType): Promise<void>;
  /** Delivery URL with automatic format and quality, which also drops EXIF/location metadata. */
  deliveryUrl(publicId: string, resourceType: ResourceType): string;
  /** Video only: a still image from the first frame. */
  posterUrl(publicId: string): string;
}
