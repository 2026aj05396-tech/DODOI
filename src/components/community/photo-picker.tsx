"use client";

import { Camera, X } from "lucide-react";
import { useRef, useState } from "react";

import { uploadMedia } from "@/lib/api-client/media";
import { ApiRequestError } from "@/lib/api-client/request";
import type { Media } from "@/lib/types/media";

// Photos for a community post (COM-05): up to `max` images, uploaded as purpose `community`.

const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif";

export function PhotoPicker({
  photos,
  max,
  onChange,
  onError,
  onBusyChange,
}: {
  photos: Media[];
  max: number;
  onChange: (photos: Media[]) => void;
  onError: (message: string) => void;
  onBusyChange?: (isBusy: boolean) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  async function add(file: File) {
    setIsUploading(true);
    onBusyChange?.(true);
    try {
      onChange([...photos, await uploadMedia(file, { purpose: "community" })]);
    } catch (caught) {
      onError(caught instanceof ApiRequestError ? caught.message : "We couldn't use that photo.");
    } finally {
      setIsUploading(false);
      onBusyChange?.(false);
    }
  }

  return (
    <ul className="flex flex-wrap gap-2.5">
      {photos.map((photo, index) => (
        <li key={photo.id} className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary serves the sizes in srcSet. */}
          <img
            src={photo.url}
            srcSet={photo.srcSet}
            sizes="80px"
            alt={`Photo ${index + 1}`}
            className="size-20 rounded-md object-cover"
          />
          <button
            type="button"
            aria-label={`Remove photo ${index + 1}`}
            onClick={() => onChange(photos.filter((item) => item.id !== photo.id))}
            className="absolute -top-2 -right-2 flex size-8 items-center justify-center rounded-full bg-inverse text-inverse-foreground"
          >
            <X aria-hidden className="size-4" />
          </button>
        </li>
      ))}
      {photos.length < max ? (
        <li>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void add(file);
            }}
          />
          <button
            type="button"
            disabled={isUploading}
            onClick={() => fileRef.current?.click()}
            className="flex size-20 flex-col items-center justify-center gap-1 rounded-md border-control border-dashed border-border-strong text-meta text-foreground-secondary hover:bg-muted"
          >
            <Camera aria-hidden className="size-5" />
            {isUploading ? "Uploading…" : "Add photo"}
          </button>
        </li>
      ) : null}
    </ul>
  );
}
