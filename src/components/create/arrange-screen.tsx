"use client";

import { ArrowDown, ArrowUp, Crop, GripVertical, Info } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Label, Textarea } from "@/components/ui/input";
import { ALT_TEXT_MAX_LENGTH } from "@/lib/schemas/media";
import { cn } from "@/lib/utils/cn";

import { isSmallPhoto, MediaPreview, SMALL_PHOTO_NOTE, UploadBadge } from "./media-thumb";
import type { UploadItem } from "./use-uploads";

// Arrange (F-17 step 3): order (arrows everywhere, drag with a pointer on wide screens), the first
// item is the cover, and every photo gets a description for people who can't see it (CRT-03).

export function ArrangeScreen({
  items,
  error,
  onMove,
  onMoveTo,
  onAltTextChange,
  onAltTextBlur,
  onEdit,
}: {
  items: UploadItem[];
  /** From Share, e.g. "Every photo needs alt text." */
  error: string | null;
  onMove: (key: string, offset: -1 | 1) => void;
  onMoveTo: (key: string, targetKey: string) => void;
  onAltTextChange: (key: string, text: string) => void;
  onAltTextBlur: (key: string) => void;
  onEdit: (key: string) => void;
}) {
  const [dragged, setDragged] = useState<string | null>(null);
  const photos = items.filter((item) => item.type === "IMAGE");
  const described = photos.filter((item) => item.altText.trim()).length;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-5 py-6 md:px-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-body text-foreground-secondary">
          Drag or use the arrows to change the order. The first one is the cover.
        </p>
        {photos.length > 0 ? (
          <p
            className={cn(
              "rounded-full px-3 py-1 text-meta font-bold",
              described === photos.length ? "bg-mint text-foreground" : "bg-butter text-foreground",
            )}
            aria-live="polite"
          >
            {described} of {photos.length} photos described
          </p>
        ) : null}
      </div>
      <FieldError id="photos-error" role="alert">
        {error}
      </FieldError>

      <ol className="flex flex-col gap-3">
        {items.map((item, index) => {
          const altId = `alt-${item.key}`;
          return (
            <li
              key={item.key}
              draggable
              onDragStart={() => setDragged(item.key)}
              onDragEnd={() => setDragged(null)}
              onDragOver={(event) => {
                event.preventDefault();
                if (dragged && dragged !== item.key) onMoveTo(dragged, item.key);
              }}
              className={cn(
                "grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 rounded-card border border-border bg-card p-3 transition duration-200 ease-soft md:gap-4",
                dragged === item.key && "scale-[0.98] opacity-60 shadow-hover",
              )}
            >
              <div className="relative size-20 overflow-hidden rounded-md md:size-24">
                <MediaPreview item={item} className="size-full" />
                <UploadBadge item={item} />
                {index === 0 ? (
                  <span className="absolute inset-x-0 bottom-0 bg-inverse/70 py-0.5 text-center text-badge-sm text-inverse-foreground uppercase">
                    Cover
                  </span>
                ) : null}
              </div>

              <div className="flex min-w-0 flex-col gap-1.5">
                {item.type === "IMAGE" ? (
                  <>
                    <Label htmlFor={altId}>Describe photo {index + 1}</Label>
                    <Textarea
                      id={altId}
                      rows={2}
                      maxLength={ALT_TEXT_MAX_LENGTH}
                      placeholder="For people who can't see it, e.g. A blue granny square on a wooden table"
                      value={item.altText}
                      disabled={!item.media}
                      onChange={(event) => onAltTextChange(item.key, event.target.value)}
                      onBlur={() => onAltTextBlur(item.key)}
                    />
                  </>
                ) : (
                  <p className="pt-1 text-body text-foreground-secondary">
                    Video {index + 1} · videos don&apos;t need a description
                  </p>
                )}
                {isSmallPhoto(item) ? (
                  <p className="flex items-start gap-1.5 text-meta text-foreground-secondary">
                    <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                    {SMALL_PHOTO_NOTE}
                  </p>
                ) : null}
                {item.type === "IMAGE" && item.previewUrl && item.status !== "failed" ? (
                  <Button
                    variant="text"
                    className="self-start text-control"
                    onClick={() => onEdit(item.key)}
                  >
                    <Crop aria-hidden className="size-4" />
                    Edit photo {index + 1}
                  </Button>
                ) : null}
              </div>

              <div className="flex flex-col items-center gap-1">
                <GripVertical
                  aria-hidden
                  className="hidden size-5 cursor-grab text-muted-foreground md:block"
                />
                <button
                  type="button"
                  onClick={() => onMove(item.key, -1)}
                  disabled={index === 0}
                  aria-label={`Move ${index + 1} earlier`}
                  className="flex size-10 items-center justify-center rounded-full text-foreground hover:bg-muted disabled:opacity-30"
                >
                  <ArrowUp aria-hidden className="size-4.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onMove(item.key, 1)}
                  disabled={index === items.length - 1}
                  aria-label={`Move ${index + 1} later`}
                  className="flex size-10 items-center justify-center rounded-full text-foreground hover:bg-muted disabled:opacity-30"
                >
                  <ArrowDown aria-hidden className="size-4.5" />
                </button>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
