import "server-only";

import { createHash } from "node:crypto";

import { MEDIA_ORIGIN } from "@/lib/constants/media";

import type { DeliveryOptions, MediaProvider, ProviderAsset, ResourceType } from "./types";

// Cloudinary over its REST APIs (no SDK): signed uploads straight from the browser
// (https://cloudinary.com/documentation/upload_images#authenticated_requests), signed uploads from
// the server for the seed importer, the Admin API to read and delete assets. Only signed uploads are possible; unsigned presets stay disabled.

const API_BASE = "https://api.cloudinary.com/v1_1";
const DELIVERY_BASE = MEDIA_ORIGIN;
const REQUEST_TIMEOUT_MS = 10_000;
/** Server uploads send the whole file (videos up to 50 MB). */
const UPLOAD_TIMEOUT_MS = 120_000;
/**
 * The API key has full access to the Cloudinary account (free-plan keys cannot be limited to a
 * folder), so this client refuses to delete anything outside dodoi's own folder.
 */
export const DODOI_ROOT_FOLDER = "dodoi/";

type CloudinaryConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  /** Admin API base; E2E runs point it at a local mock (uploads still name the real API). */
  adminApiBase?: string;
};

/** `c_limit` scales down to the width but never up, so small originals are sent as they are. */
function scaling({ width }: DeliveryOptions): string {
  return width ? `,c_limit,w_${width}` : "";
}

/** Cloudinary's signature: the sorted `key=value` pairs joined with `&`, plus the secret, SHA-1. */
export function signParams(params: Record<string, string | number>, apiSecret: string): string {
  const payload = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return createHash("sha1").update(`${payload}${apiSecret}`).digest("hex");
}

type AdminResource = {
  public_id: string;
  resource_type: ResourceType;
  format: string;
  bytes: number;
  width: number;
  height: number;
  duration?: number;
};

function toProviderAsset(resource: AdminResource): ProviderAsset {
  return {
    publicId: resource.public_id,
    resourceType: resource.resource_type,
    format: resource.format,
    bytes: resource.bytes,
    width: resource.width,
    height: resource.height,
    durationSec: resource.duration ?? null,
  };
}

export function createCloudinaryProvider(config: CloudinaryConfig): MediaProvider {
  const authorization = `Basic ${Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString("base64")}`;

  async function adminRequest(path: string, init: RequestInit = {}): Promise<Response> {
    return fetch(`${config.adminApiBase ?? API_BASE}/${config.cloudName}${path}`, {
      ...init,
      headers: { authorization, ...init.headers },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  }

  return {
    signUpload({ folder, resourceType, allowedFormats }) {
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = signParams(
        { allowed_formats: allowedFormats, folder, timestamp },
        config.apiSecret,
      );
      return {
        uploadUrl: `${API_BASE}/${config.cloudName}/${resourceType}/upload`,
        apiKey: config.apiKey,
        timestamp,
        signature,
        folder,
        resourceType,
        allowedFormats,
      };
    },

    async uploadFile({ file, fileName, publicId, resourceType, allowedFormats }) {
      const timestamp = Math.floor(Date.now() / 1000);
      const signed = { allowed_formats: allowedFormats, public_id: publicId, timestamp };
      const body = new FormData();
      body.set("file", file, fileName);
      for (const [key, value] of Object.entries(signed)) body.set(key, String(value));
      body.set("api_key", config.apiKey);
      body.set("signature", signParams(signed, config.apiSecret));

      const response = await fetch(`${API_BASE}/${config.cloudName}/${resourceType}/upload`, {
        method: "POST",
        body,
        signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Cloudinary upload of ${fileName} failed (${response.status}): ${detail}`);
      }
      return toProviderAsset((await response.json()) as AdminResource);
    },

    async getAsset(publicId, resourceType): Promise<ProviderAsset | null> {
      const response = await adminRequest(
        `/resources/${resourceType}/upload/${encodeURIComponent(publicId).replaceAll("%2F", "/")}`,
      );
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`Cloudinary asset lookup failed (${response.status})`);
      return toProviderAsset((await response.json()) as AdminResource);
    },

    async deleteAsset(publicId, resourceType) {
      if (!publicId.startsWith(DODOI_ROOT_FOLDER)) {
        throw new Error(`Refusing to delete a Cloudinary asset outside ${DODOI_ROOT_FOLDER}`);
      }
      const params = new URLSearchParams({ "public_ids[]": publicId, invalidate: "true" });
      const response = await adminRequest(`/resources/${resourceType}/upload?${params}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error(`Cloudinary delete failed (${response.status})`);
    },

    deliveryUrl(publicId, resourceType, options = {}) {
      return `${DELIVERY_BASE}/${config.cloudName}/${resourceType}/upload/f_auto,q_auto${scaling(options)}/${publicId}`;
    },

    posterUrl(publicId, options = {}) {
      return `${DELIVERY_BASE}/${config.cloudName}/video/upload/so_0,f_auto,q_auto${scaling(options)}/${publicId}.jpg`;
    },
  };
}
