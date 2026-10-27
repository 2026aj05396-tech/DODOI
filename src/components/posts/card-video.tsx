"use client";

import { Play } from "lucide-react";
import { useState } from "react";

import type { Media } from "@/lib/types/media";

// Video on a feed card (FEED-12, OD-15): the poster with a play button and duration; it plays only
// when tapped, muted with controls, and is never preloaded. Sits on top of the card's media, outside
// the card link, so tapping the rest of the card still opens the post.

function duration(seconds: number | undefined): string | null {
  if (seconds === undefined) return null;
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

export function CardVideo({ media, title }: { media: Media; title: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const length = duration(media.durationSec);

  if (isPlaying) {
    return (
      <video
        src={media.url}
        poster={media.posterUrl}
        controls
        autoPlay
        muted
        playsInline
        preload="none"
        aria-label={media.altText ?? title}
        className="pointer-events-auto absolute inset-0 size-full rounded-card bg-inverse object-contain"
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => setIsPlaying(true)}
      className="pointer-events-auto absolute bottom-2.5 left-2.5 flex h-8 items-center gap-1.5 rounded-full bg-inverse/80 px-2.5 text-badge text-inverse-foreground"
    >
      <Play aria-hidden className="size-3.5" fill="currentColor" />
      {/* The name includes the visible duration, so voice control users can say it (WCAG 2.5.3). */}
      <span className="sr-only">Play video: {title}</span>
      {length ? <span>{length}</span> : null}
    </button>
  );
}
