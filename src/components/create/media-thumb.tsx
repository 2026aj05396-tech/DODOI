import { AlertCircle, Check, Play } from "lucide-react";

import { PatternTile } from "@/components/ui/pattern-tile";
import { SHARP_IMAGE_MIN_SIDE } from "@/lib/schemas/media";
import { cn } from "@/lib/utils/cn";

import type { UploadItem } from "./use-uploads";

// A picked photo or video with its upload state: a progress ring while uploading, a soft check when
// done (UI_UX_GUIDELINES §8.1), a warning when it failed.

const RING_RADIUS = 15;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

/** A photo small enough to look soft on big screens (a note, never a block; PO 2026-10-29). */
export function isSmallPhoto(item: UploadItem): boolean {
  const media = item.media;
  return media?.type === "IMAGE" && Math.min(media.width, media.height) < SHARP_IMAGE_MIN_SIDE;
}

export const SMALL_PHOTO_NOTE = "This photo is small, so it may look a little soft on big screens.";

export function ProgressRing({ progress }: { progress: number }) {
  return (
    <svg viewBox="0 0 36 36" className="size-9 -rotate-90" aria-hidden>
      <circle
        cx="18"
        cy="18"
        r={RING_RADIUS}
        className="fill-inverse/40 stroke-inverse-foreground/40"
        strokeWidth="3"
      />
      <circle
        cx="18"
        cy="18"
        r={RING_RADIUS}
        fill="none"
        className="stroke-inverse-foreground transition-[stroke-dashoffset] duration-200"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={RING_LENGTH}
        strokeDashoffset={RING_LENGTH * (1 - Math.max(0.04, progress))}
      />
    </svg>
  );
}

export function MediaPreview({
  item,
  className,
  fit = "cover",
}: {
  item: UploadItem;
  className?: string;
  fit?: "cover" | "contain";
}) {
  const fitClass = fit === "cover" ? "object-cover" : "object-contain";
  if (!item.previewUrl) {
    return <PatternTile accent="lavender" className={cn("rounded-none", className)} />;
  }
  if (item.type === "VIDEO" && !item.media) {
    return (
      <video
        src={item.previewUrl}
        muted
        playsInline
        preload="metadata"
        className={cn(fitClass, className)}
        aria-hidden
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- local previews (blob:) and delivered files at their own size
    <img src={item.previewUrl} alt="" className={cn(fitClass, className)} />
  );
}

/** Upload state drawn over a thumbnail. */
export function UploadBadge({ item }: { item: UploadItem }) {
  if (item.status === "uploading") {
    return (
      <span className="absolute inset-0 flex items-center justify-center bg-inverse/20">
        <ProgressRing progress={item.progress} />
        <span className="sr-only">Uploading, {Math.round(item.progress * 100)}%</span>
      </span>
    );
  }
  if (item.status === "failed") {
    return (
      <span className="absolute inset-0 flex items-center justify-center bg-destructive-surface/80 text-destructive">
        <AlertCircle aria-hidden className="size-6" />
        <span className="sr-only">Upload failed</span>
      </span>
    );
  }
  return (
    <>
      {item.type === "VIDEO" ? (
        <span className="absolute bottom-1.5 left-1.5 flex size-6 items-center justify-center rounded-full bg-inverse/60 text-inverse-foreground">
          <Play aria-hidden className="size-3.5" fill="currentColor" />
        </span>
      ) : null}
      <span className="absolute top-1.5 left-1.5 flex size-5 animate-dd-pop items-center justify-center rounded-full bg-mint text-foreground">
        <Check aria-hidden className="size-3" strokeWidth={3} />
        <span className="sr-only">Uploaded</span>
      </span>
    </>
  );
}
