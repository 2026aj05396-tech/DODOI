"use client";

import { useState } from "react";

import { PatternTile, type PatternAccent } from "@/components/ui/pattern-tile";
import type { Media } from "@/lib/types/media";

/** Card grids: 2 columns on phones, ~360px columns on tablets, at most ~320px on desktops. */
const CARD_SIZES = "(min-width: 1024px) 320px, (min-width: 768px) 360px, 50vw";

/**
 * A card's cover image. If it fails to load, the skill's craft pattern takes its place (FEED-10),
 * so the card keeps its size and never shows a broken image.
 */
export function CardImage({ media, fallback }: { media: Media; fallback: PatternAccent }) {
  const [hasFailed, setHasFailed] = useState(false);
  if (hasFailed) return <PatternTile accent={fallback} className="size-full rounded-none" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- Cloudinary serves the sizes in srcSet.
    <img
      src={media.posterUrl ?? media.url}
      srcSet={media.srcSet}
      sizes={CARD_SIZES}
      alt={media.altText ?? ""}
      width={media.width}
      height={media.height}
      loading="lazy"
      onError={() => setHasFailed(true)}
      className="size-full object-cover"
    />
  );
}
