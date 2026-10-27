"use client";

import { ArrowDown, ArrowUp, Play, Trash2 } from "lucide-react";
import { useId, useRef, useState, type ChangeEvent } from "react";

import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { FieldError } from "@/components/ui/field-error";
import { Input, Label } from "@/components/ui/input";
import { uploadMedia } from "@/lib/api-client/media";
import { ApiRequestError } from "@/lib/api-client/request";
import type { MediaPurpose } from "@/lib/schemas/media";
import type { Media } from "@/lib/types/media";

/** Accepted in the file picker; the server re-checks every file (MEDIA-01…03). */
const ACCEPT_IMAGES = "image/jpeg,image/png,image/webp,image/heic,image/heif";
const ACCEPT_MEDIA = `${ACCEPT_IMAGES},video/mp4,video/quicktime,video/webm`;

type Uploading = { key: string; name: string; progress: number };

type MediaFieldProps = {
  label: string;
  items: Media[];
  onChange: (items: Media[]) => void;
  purpose: MediaPurpose;
  /** Most items allowed; 1 makes it a single image field (e.g. a cover). */
  max: number;
  allowVideo?: boolean;
  error?: string;
};

/**
 * Upload, describe, reorder and remove photos and videos (ADM-05). Order is the gallery order.
 * Alt text changes are kept in `items` and saved by the editor.
 */
export function MediaField({
  label,
  items,
  onChange,
  purpose,
  max,
  allowVideo = false,
  error,
}: MediaFieldProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<Uploading[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const room = max - items.length - uploading.length;

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])].slice(0, Math.max(room, 0));
    event.target.value = "";
    setUploadError(null);
    let added: Media[] = [];
    await Promise.all(
      files.map(async (file, index) => {
        const key = `${Date.now()}-${index}`;
        setUploading((current) => [...current, { key, name: file.name, progress: 0 }]);
        try {
          const media = await uploadMedia(file, {
            purpose,
            onProgress: (progress) =>
              setUploading((current) =>
                current.map((item) => (item.key === key ? { ...item, progress } : item)),
              ),
          });
          added = [...added, media];
        } catch (caught) {
          setUploadError(
            `${file.name}: ${caught instanceof ApiRequestError ? caught.message : "The upload didn't work."}`,
          );
        } finally {
          setUploading((current) => current.filter((item) => item.key !== key));
        }
      }),
    );
    if (added.length > 0) onChange([...items, ...added]);
  }

  function move(index: number, by: -1 | 1) {
    const next = [...items];
    const [moved] = next.splice(index, 1);
    if (moved) next.splice(index + by, 0, moved);
    onChange(next);
  }

  return (
    <fieldset className="flex flex-col gap-3" aria-describedby={error ? `${id}-error` : undefined}>
      <legend className="text-control-sm font-bold text-foreground">{label}</legend>

      {items.length > 0 ? (
        <ol className="flex flex-col gap-3">
          {items.map((media, index) => (
            <li
              key={media.id}
              className="grid grid-cols-[80px_minmax(0,1fr)] gap-3 rounded-md border border-border-faint bg-background p-3 md:grid-cols-[96px_minmax(0,1fr)_auto]"
            >
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary serves the sizes in srcSet. */}
                <img
                  src={media.posterUrl ?? media.url}
                  srcSet={media.srcSet}
                  sizes="96px"
                  alt=""
                  className="aspect-square w-full rounded-md bg-muted object-cover"
                />
                {media.type === "VIDEO" ? (
                  <span className="absolute right-1 bottom-1 inline-flex items-center gap-1 rounded-full bg-inverse px-1.5 py-0.5 text-tab text-inverse-foreground">
                    <Play aria-hidden className="size-3" /> {Math.round(media.durationSec ?? 0)}s
                  </span>
                ) : null}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${id}-alt-${media.id}`}>
                  {media.type === "VIDEO" ? "Description (optional)" : "Alt text"}
                </Label>
                <Input
                  id={`${id}-alt-${media.id}`}
                  value={media.altText ?? ""}
                  maxLength={300}
                  placeholder={media.type === "VIDEO" ? "" : "What's in the photo?"}
                  onChange={(event) =>
                    onChange(
                      items.map((item) =>
                        item.id === media.id ? { ...item, altText: event.target.value } : item,
                      ),
                    )
                  }
                />
              </div>
              <div className="col-span-2 flex gap-1 md:col-span-1 md:flex-col md:justify-center">
                {max > 1 ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                      aria-label={`Move item ${index + 1} up`}
                    >
                      <ArrowUp aria-hidden className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={index === items.length - 1}
                      onClick={() => move(index, 1)}
                      aria-label={`Move item ${index + 1} down`}
                    >
                      <ArrowDown aria-hidden className="size-4" />
                    </Button>
                  </>
                ) : null}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onChange(items.filter((item) => item.id !== media.id))}
                  aria-label={`Remove item ${index + 1}`}
                >
                  <Trash2 aria-hidden className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ol>
      ) : null}

      {uploading.map((item) => (
        <div key={item.key} role="status" className="flex flex-col gap-1">
          <span className="text-meta text-foreground-secondary">Uploading {item.name}…</span>
          <progress value={item.progress} max={1} className="h-2 w-full accent-primary" />
        </div>
      ))}

      {uploadError ? <ErrorBanner>{uploadError}</ErrorBanner> : null}
      <FieldError id={`${id}-error`}>{error}</FieldError>

      {room > 0 ? (
        <div>
          <input
            ref={inputRef}
            id={`${id}-file`}
            type="file"
            accept={allowVideo ? ACCEPT_MEDIA : ACCEPT_IMAGES}
            multiple={max > 1}
            // The visible button opens the picker; keep the input out of the tab order.
            tabIndex={-1}
            aria-hidden
            className="sr-only"
            onChange={handleFiles}
          />
          <Button variant="outline" onClick={() => inputRef.current?.click()}>
            {max === 1
              ? "Upload image"
              : allowVideo
                ? `Add photos or videos (${room} left)`
                : `Add photos (${room} left)`}
          </Button>
          <p className="pt-1.5 text-meta text-foreground-secondary">
            {allowVideo
              ? "JPEG, PNG, WebP or HEIC up to 10 MB (at least 600 px); MP4, MOV or WebM up to 60 s and 50 MB."
              : "JPEG, PNG, WebP or HEIC up to 10 MB."}
          </p>
        </div>
      ) : null}
    </fieldset>
  );
}
