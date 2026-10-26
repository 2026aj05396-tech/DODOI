"use client";

import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { useRef, useState } from "react";

import type { Media } from "@/lib/types/media";
import { cn } from "@/lib/utils/cn";

// Post media (POST-01, PO decision P1-20): up to 10 photos and videos. One scroll-snap track for
// every width: swipe with dots and a "2 / 5" counter on mobile; arrows and thumbnails from 768px.
// The frame takes the first item's shape (kept between 4:5 and 4:3) before anything loads, so the
// page never shifts (no CLS); other items are fitted inside it. Videos show their poster until
// tapped, then play inline with controls.

const MIN_RATIO = 4 / 5;
const MAX_RATIO = 4 / 3;

function frameRatio(media: Media[]): number {
  const first = media[0];
  if (!first || first.height === 0) return 1;
  return Math.min(MAX_RATIO, Math.max(MIN_RATIO, first.width / first.height));
}

function Slide({
  media,
  index,
  count,
  isPlaying,
  onPlay,
}: {
  media: Media;
  index: number;
  count: number;
  isPlaying: boolean;
  onPlay: () => void;
}) {
  const label = count > 1 ? `${index + 1} of ${count}` : undefined;
  if (media.type === "VIDEO") {
    return (
      <div
        role="group"
        aria-roledescription="slide"
        aria-label={label}
        className="relative size-full"
      >
        {isPlaying ? (
          <video
            src={media.url}
            poster={media.posterUrl}
            controls
            autoPlay
            playsInline
            aria-label={media.altText ?? "Video"}
            className="size-full bg-inverse object-contain"
          />
        ) : (
          <button
            type="button"
            onClick={onPlay}
            aria-label={media.altText ? `Play video: ${media.altText}` : "Play video"}
            className="group relative size-full"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary sizes the image. */}
            <img
              src={media.posterUrl}
              alt=""
              width={media.width}
              height={media.height}
              loading={index === 0 ? "eager" : "lazy"}
              className="size-full object-contain"
            />
            <span className="absolute inset-0 m-auto flex size-16 items-center justify-center rounded-full bg-background/90 text-foreground shadow-float transition-transform group-active:scale-96">
              <Play aria-hidden className="ml-1 size-7" fill="currentColor" />
            </span>
          </button>
        )}
      </div>
    );
  }
  return (
    <div role="group" aria-roledescription="slide" aria-label={label} className="size-full">
      {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary sizes the image. */}
      <img
        src={media.url}
        alt={media.altText ?? ""}
        width={media.width}
        height={media.height}
        loading={index === 0 ? "eager" : "lazy"}
        fetchPriority={index === 0 ? "high" : undefined}
        className="size-full object-contain"
      />
    </div>
  );
}

export function PostGallery({
  media,
  className,
  frameClassName,
}: {
  media: Media[];
  className?: string;
  /** Extra classes for the media frame, e.g. rounded corners from 768px. */
  frameClassName?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const count = media.length;
  const hasSeveral = count > 1;

  function goTo(index: number) {
    const track = trackRef.current;
    if (!track) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.scrollTo({ left: index * track.clientWidth, behavior: reduceMotion ? "auto" : "smooth" });
  }

  function onScroll() {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    const index = Math.round(track.scrollLeft / track.clientWidth);
    if (index !== current) {
      setCurrent(index);
      // Leaving a playing video stops it.
      setPlayingId(null);
    }
  }

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Photos and videos"
      className={cn("flex flex-col gap-3", className)}
    >
      <div
        className={cn("relative overflow-hidden bg-muted", frameClassName)}
        style={{ aspectRatio: frameRatio(media) }}
      >
        <div
          ref={trackRef}
          onScroll={onScroll}
          // Focusable so keyboard users can scroll it with the arrow keys.
          tabIndex={hasSeveral ? 0 : undefined}
          className="flex size-full snap-x snap-mandatory scrollbar-none overflow-x-auto overscroll-x-contain"
        >
          {media.map((item, index) => (
            <div key={item.id} className="size-full shrink-0 snap-center">
              <Slide
                media={item}
                index={index}
                count={count}
                isPlaying={playingId === item.id}
                onPlay={() => setPlayingId(item.id)}
              />
            </div>
          ))}
        </div>

        {hasSeveral ? (
          <>
            <p
              aria-live="polite"
              className="absolute right-3 bottom-3 rounded-full bg-inverse/80 px-2.5 py-1 text-badge text-inverse-foreground"
            >
              <span className="sr-only">Showing </span>
              {current + 1} / {count}
            </p>
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-4 flex justify-center gap-1.5 md:hidden"
            >
              {media.map((item, index) => (
                <span
                  key={item.id}
                  className={cn(
                    "size-1.5 rounded-full transition-colors",
                    index === current ? "bg-background" : "bg-background/50",
                  )}
                />
              ))}
            </div>
            <button
              type="button"
              aria-label="Previous photo or video"
              disabled={current === 0}
              onClick={() => goTo(current - 1)}
              className="absolute top-1/2 left-3 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-background text-foreground shadow-float disabled:opacity-0 md:flex"
            >
              <ChevronLeft aria-hidden className="size-5" />
            </button>
            <button
              type="button"
              aria-label="Next photo or video"
              disabled={current === count - 1}
              onClick={() => goTo(current + 1)}
              className="absolute top-1/2 right-3 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-background text-foreground shadow-float disabled:opacity-0 md:flex"
            >
              <ChevronRight aria-hidden className="size-5" />
            </button>
          </>
        ) : null}
      </div>

      {hasSeveral ? (
        <ul
          className="hidden gap-2 overflow-x-auto pb-1 md:flex"
          aria-label="Choose a photo or video"
        >
          {media.map((item, index) => (
            <li key={item.id} className="shrink-0">
              <button
                type="button"
                aria-label={`Show ${index + 1} of ${count}`}
                aria-current={index === current ? "true" : undefined}
                onClick={() => goTo(index)}
                className={cn(
                  "relative block size-16 overflow-hidden rounded-md border-2 bg-muted",
                  index === current
                    ? "border-foreground"
                    : "border-transparent opacity-75 hover:opacity-100",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary sizes the image. */}
                <img
                  src={item.posterUrl ?? item.url}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover"
                />
                {item.type === "VIDEO" ? (
                  <Play
                    aria-hidden
                    className="absolute inset-0 m-auto size-5 text-inverse-foreground drop-shadow"
                    fill="currentColor"
                  />
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
