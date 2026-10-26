import type { MediaPurpose, MediaTypeName } from "@/lib/schemas/media";
import type { Media, SignedUpload } from "@/lib/types/media";

import { ApiRequestError, postJson, requestJson } from "./request";

// Media upload (API_SPECIFICATION §7): sign → upload straight to Cloudinary → register, where the
// server re-checks the file. Uses XMLHttpRequest because fetch cannot report upload progress.

export function mediaTypeOf(file: File): MediaTypeName {
  return file.type.startsWith("video/") ? "VIDEO" : "IMAGE";
}

function uploadToProvider(
  file: File,
  signed: SignedUpload,
  onProgress: (fraction: number) => void,
): Promise<string> {
  const form = new FormData();
  form.set("file", file);
  form.set("api_key", signed.apiKey);
  form.set("timestamp", String(signed.timestamp));
  form.set("signature", signed.signature);
  form.set("folder", signed.folder);
  form.set("allowed_formats", signed.allowedFormats);

  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", signed.uploadUrl);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    request.onload = () => {
      const body = JSON.parse(request.responseText || "{}") as { public_id?: string };
      if (request.status >= 200 && request.status < 300 && body.public_id) {
        resolve(body.public_id);
      } else {
        reject(
          new ApiRequestError(
            request.status,
            "UPLOAD_FAILED",
            "The upload didn't work. Check the file type and size, then try again.",
          ),
        );
      }
    };
    request.onerror = () =>
      reject(
        new ApiRequestError(
          0,
          "NETWORK_ERROR",
          "The upload stopped. Check your connection and try again.",
        ),
      );
    request.send(form);
  });
}

/** Uploads one file and returns it as saved media (the server rejects and deletes bad files). */
export async function uploadMedia(
  file: File,
  options: { purpose: MediaPurpose; altText?: string; onProgress?: (fraction: number) => void },
): Promise<Media> {
  const type = mediaTypeOf(file);
  const signed = await postJson<SignedUpload>("/api/media/sign", {
    purpose: options.purpose,
    type,
    bytes: file.size,
    mimeType: file.type,
  });
  const publicId = await uploadToProvider(file, signed, options.onProgress ?? (() => {}));
  return postJson<Media>("/api/media", {
    purpose: options.purpose,
    type,
    publicId,
    altText: options.altText,
  });
}

export function updateMediaAltText(id: string, altText: string): Promise<Media> {
  return requestJson("PATCH", `/api/media/${id}`, { altText });
}
