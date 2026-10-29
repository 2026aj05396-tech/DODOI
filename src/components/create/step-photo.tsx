"use client";

import { ImagePlus, X } from "lucide-react";
import { useId, useRef, useState } from "react";

import { Input, Label } from "@/components/ui/input";
import { mediaTypeOf, updateMediaAltText, uploadMedia } from "@/lib/api-client/media";
import { ApiRequestError } from "@/lib/api-client/request";
import { ALT_TEXT_MAX_LENGTH } from "@/lib/schemas/media";
import type { Media } from "@/lib/types/media";

import { ProgressRing } from "./media-thumb";

// An optional photo for one step (CRT-07): add → it uploads at once → describe it. Publishing needs
// a description on every step photo, like the post's own photos.

export function StepPhoto({
  stepNumber,
  media,
  onChange,
}: {
  stepNumber: number;
  media: Media | null;
  /** The step's photo after an upload, a description change, or removal (null). */
  onChange: (media: Media | null) => void;
}) {
  const inputId = useId();
  const altId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [altText, setAltText] = useState(media?.altText ?? "");

  async function upload(file: File) {
    if (mediaTypeOf(file) !== "IMAGE") {
      setError("Steps take photos only.");
      return;
    }
    setError(null);
    setProgress(0);
    try {
      onChange(await uploadMedia(file, { purpose: "post", onProgress: setProgress }));
    } catch (failure) {
      setError(
        failure instanceof ApiRequestError ? failure.message : "The upload didn't work. Try again.",
      );
    } finally {
      setProgress(null);
    }
  }

  async function saveAltText() {
    const text = altText.trim();
    if (!media || !text || text === (media.altText ?? "")) return;
    try {
      onChange(await updateMediaAltText(media.id, text));
    } catch {
      setError("We couldn't save that description. Try again.");
    }
  }

  if (progress !== null) {
    return (
      <div className="flex items-center gap-2 text-meta text-foreground-secondary">
        <span className="rounded-full bg-inverse/70 p-0.5">
          <ProgressRing progress={progress} />
        </span>
        Uploading the photo for step {stepNumber}…
      </div>
    );
  }

  if (!media) {
    return (
      <div className="flex flex-col gap-1">
        <input
          ref={input}
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          aria-label={`Photo for step ${stepNumber}`}
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void upload(file);
          }}
        />
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="inline-flex items-center gap-1.5 self-start rounded-full px-1 text-control-sm font-bold text-link hover:underline"
        >
          <ImagePlus aria-hidden className="size-4" />
          Add a photo
        </button>
        {error ? <p className="text-meta text-destructive">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5">
      <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-background">
        {/* eslint-disable-next-line @next/next/no-img-element -- small Cloudinary thumbnail */}
        <img src={media.url} alt="" className="size-full object-cover" />
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label={`Remove the photo for step ${stepNumber}`}
          className="absolute top-0.5 right-0.5 flex size-6 items-center justify-center rounded-full bg-inverse text-inverse-foreground"
        >
          <X aria-hidden className="size-3.5" strokeWidth={2.5} />
        </button>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Label htmlFor={altId} className="text-meta">
          Describe the photo
        </Label>
        <Input
          id={altId}
          value={altText}
          maxLength={ALT_TEXT_MAX_LENGTH}
          placeholder="e.g. Six stitches in a magic ring"
          onChange={(event) => setAltText(event.target.value)}
          onBlur={() => void saveAltText()}
        />
        {error ? <p className="text-meta text-destructive">{error}</p> : null}
      </div>
    </div>
  );
}
