"use client";

import { Camera, Crop, ImagePlus, Info, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { useId, useRef, useState, type DragEvent } from "react";

import { Button } from "@/components/ui/button";
import { PatternTile } from "@/components/ui/pattern-tile";
import { MAX_POST_MEDIA } from "@/lib/schemas/admin";
import type { OwnPostSummary } from "@/lib/types/posts";
import { cn } from "@/lib/utils/cn";

import { DraftsStrip } from "./drafts-strip";
import { isSmallPhoto, MediaPreview, SMALL_PHOTO_NOTE, UploadBadge } from "./media-thumb";
import { ACCEPTED_FILES, type UploadItem } from "./use-uploads";

// Pick (F-17 step 2): the big mood-board drop area first; once something is picked, a large preview
// of the selected item with the strip of everything picked below (Instagram's picker).

function filesOf(list: FileList | null): File[] {
  return list ? Array.from(list) : [];
}

export function PickScreen({
  items,
  selectedKey,
  onSelect,
  onAdd,
  onRemove,
  onRetry,
  onEdit,
  drafts,
}: {
  items: UploadItem[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  onAdd: (files: File[]) => void;
  onRemove: (key: string) => void;
  onRetry: (key: string) => void;
  /** Opens the photo editor (crop, zoom, rotate). */
  onEdit: (key: string) => void;
  drafts: OwnPostSummary[];
}) {
  const inputId = useId();
  const cameraId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const selected = items.find((item) => item.key === selectedKey) ?? items[0];
  const canAdd = items.length < MAX_POST_MEDIA;

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setIsDragging(false);
    onAdd(filesOf(event.dataTransfer.files));
  }

  const pickers = (
    <>
      <input
        ref={input}
        id={inputId}
        aria-label="Choose photos or videos"
        type="file"
        accept={ACCEPTED_FILES}
        multiple
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          onAdd(filesOf(event.target.files));
          event.target.value = "";
        }}
      />
      <input
        id={cameraId}
        aria-label="Take a photo"
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          onAdd(filesOf(event.target.files));
          event.target.value = "";
        }}
      />
    </>
  );

  if (!selected) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-5 py-6 md:px-8 md:py-10">
        {pickers}
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          className={cn(
            "relative flex min-h-[60svh] flex-col items-center justify-center gap-5 overflow-hidden rounded-xl border-2 border-dashed border-border-strong px-6 py-12 text-center transition duration-200 md:min-h-[28rem]",
            isDragging && "scale-[1.01] border-link bg-lavender/30",
          )}
        >
          <PatternTile accent="butter" className="absolute inset-0 rounded-none opacity-60" />
          <div className="relative flex size-20 animate-dd-up items-center justify-center rounded-full bg-background shadow-frame">
            <ImagePlus aria-hidden className="size-9 text-link" strokeWidth={1.6} />
          </div>
          <div className="relative flex flex-col gap-2">
            <h2 className="text-greeting text-balance text-foreground md:text-greeting-web">
              Add photos of what you made
            </h2>
            <p className="text-body text-foreground-secondary">
              Up to {MAX_POST_MEDIA} photos or short videos. They start uploading right away.
            </p>
          </div>
          <div className="relative flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" onClick={() => input.current?.click()}>
              <ImagePlus aria-hidden className="size-5" />
              Choose photos
            </Button>
            <Button asChild size="lg" variant="outline" className="bg-background md:hidden">
              <label htmlFor={cameraId}>
                <Camera aria-hidden className="size-5" />
                Take a photo
              </label>
            </Button>
          </div>
          <p className="relative hidden text-meta text-muted-foreground md:block">
            or drop them here
          </p>
        </div>

        <DraftsStrip drafts={drafts} heading="Pick up where you left off" />
      </div>
    );
  }

  return (
    <div
      className="mx-auto flex w-full max-w-3xl flex-col gap-4 pb-6 md:px-8 md:pt-6"
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
    >
      {pickers}
      <div className="relative aspect-[4/5] max-h-[62svh] w-full overflow-hidden bg-inverse md:aspect-[4/3] md:rounded-card">
        <MediaPreview
          key={selected.key}
          item={selected}
          fit="contain"
          className="size-full animate-dd-pop"
        />
        {selected.status === "uploading" ? (
          <span className="absolute inset-x-0 bottom-0 h-1 bg-inverse-foreground/20">
            <span
              className="block h-full bg-primary transition-[width] duration-200"
              style={{ width: `${Math.round(selected.progress * 100)}%` }}
            />
          </span>
        ) : null}
        {selected.status === "failed" ? (
          <div className="absolute inset-x-4 bottom-4 flex items-center justify-between gap-3 rounded-card bg-background p-3 text-body">
            <p className="text-destructive">{selected.error}</p>
            {selected.canRetry ? (
              <Button size="sm" variant="outline" onClick={() => onRetry(selected.key)}>
                <RotateCcw aria-hidden className="size-4" />
                Try again
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => onRemove(selected.key)}>
                <Trash2 aria-hidden className="size-4" />
                Remove
              </Button>
            )}
          </div>
        ) : null}
        {selected.type === "IMAGE" && selected.previewUrl && selected.status !== "failed" ? (
          <div className="absolute top-3 left-3 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="border-transparent bg-background shadow-float"
              onClick={() => onEdit(selected.key)}
            >
              <Crop aria-hidden className="size-4" />
              Edit photo
            </Button>
            {isSmallPhoto(selected) ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-butter px-3 py-1.5 text-meta text-foreground">
                <Info aria-hidden className="size-4" />
                Small photo
                <span className="sr-only">: {SMALL_PHOTO_NOTE}</span>
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <ul
        className="flex gap-2.5 overflow-x-auto px-5 pt-3 pb-2 md:px-1"
        aria-label="Picked photos and videos"
      >
        {items.map((item, index) => (
          <li key={item.key} className="relative shrink-0">
            <button
              type="button"
              onClick={() => onSelect(item.key)}
              aria-pressed={item.key === selected.key}
              aria-label={`${item.type === "VIDEO" ? "Video" : "Photo"} ${index + 1}`}
              className={cn(
                "relative block size-18 overflow-hidden rounded-md ring-offset-2 transition duration-150 md:size-20",
                item.key === selected.key ? "ring-3 ring-link" : "opacity-85 hover:opacity-100",
              )}
            >
              <MediaPreview item={item} className="size-full" />
              <UploadBadge item={item} />
            </button>
            <button
              type="button"
              onClick={() => onRemove(item.key)}
              aria-label={`Remove ${item.type === "VIDEO" ? "video" : "photo"} ${index + 1}`}
              className="absolute -top-2 -right-2 flex size-7 items-center justify-center rounded-full bg-inverse text-inverse-foreground shadow-hover"
            >
              <X aria-hidden className="size-3.5" strokeWidth={2.5} />
            </button>
          </li>
        ))}
        {canAdd ? (
          <li className="shrink-0">
            <button
              type="button"
              onClick={() => input.current?.click()}
              className="flex size-18 flex-col items-center justify-center gap-0.5 rounded-md border-2 border-dashed border-border-strong text-meta text-foreground-secondary hover:border-link hover:text-link md:size-20"
            >
              <Plus aria-hidden className="size-5" />
              Add
            </button>
          </li>
        ) : null}
      </ul>
      <p className="px-5 text-meta text-muted-foreground md:px-0">
        {items.length} of {MAX_POST_MEDIA} · the first one is the cover
      </p>
    </div>
  );
}
