"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { mediaTypeOf, updateMediaAltText, uploadMedia } from "@/lib/api-client/media";
import { ApiRequestError } from "@/lib/api-client/request";
import { MAX_POST_MEDIA } from "@/lib/schemas/admin";
import type { Media } from "@/lib/types/media";
import { shrinkImage } from "@/lib/utils/image-edit";

// Photos and videos of the post being created (F-17 steps 1–3). Each file starts uploading the
// moment it is picked (Instagram's trick, UI_UX_GUIDELINES §8.1), so later screens never wait.

export type UploadItem = {
  key: string;
  type: "IMAGE" | "VIDEO";
  /** What the screen shows: a local preview while uploading, the delivered file afterwards. */
  previewUrl: string | null;
  /** The picked file on this device (full quality, for the photo editor); null for HEIC. */
  localUrl: string | null;
  /** 0–1 while uploading. */
  progress: number;
  status: "uploading" | "done" | "failed";
  media: Media | null;
  error: string | null;
  /** True when trying the same file again can help (the connection dropped). */
  canRetry: boolean;
  altText: string;
};

/** MEDIA-01: the server refuses larger images, so bigger photos are shrunk before uploading. */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export const ACCEPTED_FILES =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime,video/webm";

let nextKey = 1;

function fromMedia(media: Media): UploadItem {
  return {
    key: `media-${media.id}`,
    type: media.type,
    previewUrl: media.type === "VIDEO" ? (media.posterUrl ?? null) : media.url,
    localUrl: null,
    progress: 1,
    status: "done",
    media,
    error: null,
    canRetry: false,
    altText: media.altText ?? "",
  };
}

/** HEIC photos can't be previewed by most browsers until Cloudinary has converted them. */
function canPreview(file: File): boolean {
  return !/heic|heif/i.test(file.type);
}

export function useUploads(initial: Media[]) {
  const [items, setItems] = useState<UploadItem[]>(() => initial.map(fromMedia));
  const objectUrls = useRef(new Set<string>());
  const generation = useRef(new Map<string, number>());

  useEffect(() => {
    const urls = objectUrls.current;
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, []);

  const update = useCallback((key: string, change: Partial<UploadItem>) => {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...change } : item)),
    );
  }, []);

  const start = useCallback(
    (key: string, picked: File, altText?: string) => {
      // Only the latest upload of an item may report back (an edit replaces one mid-upload).
      const run = (generation.current.get(key) ?? 0) + 1;
      generation.current.set(key, run);
      const report = (change: Partial<UploadItem>) => {
        if (generation.current.get(key) === run) update(key, change);
      };
      update(key, { status: "uploading", progress: 0, error: null, canRetry: false });
      // Photos over the 10 MB limit are made smaller here rather than turned away (PO, 2026-10-29).
      const ready =
        mediaTypeOf(picked) === "IMAGE" && picked.size > MAX_IMAGE_BYTES && canPreview(picked)
          ? shrinkImage(picked)
          : Promise.resolve(picked);
      ready
        .then((file) =>
          uploadMedia(file, {
            purpose: "post",
            altText: altText?.trim() || undefined,
            onProgress: (fraction) => report({ progress: fraction }),
          }),
        )
        .then((media) =>
          report({
            status: "done",
            progress: 1,
            media,
            // The delivered file also shows HEIC photos, which browsers can't preview locally.
            previewUrl: media.type === "VIDEO" ? (media.posterUrl ?? null) : media.url,
          }),
        )
        .catch((error: unknown) =>
          report({
            status: "failed",
            error:
              error instanceof ApiRequestError
                ? error.message
                : "The upload didn't work. Try again.",
            canRetry:
              !(error instanceof ApiRequestError) ||
              ["NETWORK_ERROR", "OFFLINE", "UPLOAD_FAILED", "INTERNAL_ERROR"].includes(error.code),
          }),
        );
    },
    [update],
  );

  const files = useRef(new Map<string, File>());
  const count = useRef(items.length);
  useEffect(() => {
    count.current = items.length;
  }, [items.length]);

  /** Adds picked files (up to the 10-item limit) and starts uploading them. Returns how many fit. */
  const add = useCallback(
    (picked: File[]): number => {
      const room = Math.max(0, MAX_POST_MEDIA - count.current);
      const added: UploadItem[] = picked.slice(0, room).map((file) => {
        let previewUrl: string | null = null;
        if (canPreview(file)) {
          previewUrl = URL.createObjectURL(file);
          objectUrls.current.add(previewUrl);
        }
        const key = `file-${nextKey++}`;
        files.current.set(key, file);
        return {
          key,
          type: mediaTypeOf(file),
          previewUrl,
          localUrl: previewUrl,
          progress: 0,
          status: "uploading",
          media: null,
          error: null,
          canRetry: false,
          altText: "",
        };
      });
      count.current += added.length;
      // Queued before the uploads' progress updates, so each update finds its item.
      setItems((current) => [...current, ...added]);
      for (const item of added) {
        const file = files.current.get(item.key);
        if (file) start(item.key, file);
      }
      return added.length;
    },
    [start],
  );

  const retry = useCallback(
    (key: string) => {
      const file = files.current.get(key);
      if (file) start(key, file);
    },
    [start],
  );

  /**
   * Swaps an item for its edited version (the photo editor): same place, same description, a new
   * upload. The old file is left for the daily orphan cleanup.
   */
  const replace = useCallback(
    (key: string, file: File, altText: string) => {
      const previewUrl = URL.createObjectURL(file);
      objectUrls.current.add(previewUrl);
      files.current.set(key, file);
      update(key, { type: "IMAGE", previewUrl, localUrl: previewUrl, media: null });
      start(key, file, altText);
    },
    [start, update],
  );

  const remove = useCallback((key: string) => {
    files.current.delete(key);
    setItems((current) => current.filter((item) => item.key !== key));
  }, []);

  /** Moves an item one place earlier (-1) or later (+1); the first item is the cover. */
  const move = useCallback((key: string, offset: -1 | 1) => {
    setItems((current) => {
      const from = current.findIndex((item) => item.key === key);
      const to = from + offset;
      if (from < 0 || to < 0 || to >= current.length) return current;
      const next = [...current];
      const [item] = next.splice(from, 1);
      if (item) next.splice(to, 0, item);
      return next;
    });
  }, []);

  /** Drops the dragged item at `targetKey`'s place (pointer drag on wide screens). */
  const moveTo = useCallback((key: string, targetKey: string) => {
    setItems((current) => {
      const from = current.findIndex((item) => item.key === key);
      const to = current.findIndex((item) => item.key === targetKey);
      if (from < 0 || to < 0 || from === to) return current;
      const next = [...current];
      const [item] = next.splice(from, 1);
      if (item) next.splice(to, 0, item);
      return next;
    });
  }, []);

  const setAltText = useCallback(
    (key: string, altText: string) => update(key, { altText }),
    [update],
  );

  /** Saves a photo's alt text (on blur); it belongs to the photo, so it is saved straight away. */
  const saveAltText = useCallback(
    async (key: string) => {
      const item = items.find((entry) => entry.key === key);
      const text = item?.altText.trim() ?? "";
      if (!item?.media || !text || text === (item.media.altText ?? "")) return;
      const media = await updateMediaAltText(item.media.id, text);
      update(key, { media });
    },
    [items, update],
  );

  return { items, add, retry, replace, remove, move, moveTo, setAltText, saveAltText };
}
