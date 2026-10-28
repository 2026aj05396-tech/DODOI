"use client";

import Image from "next/image";
import { useState } from "react";

import { cn } from "@/lib/utils/cn";

// A photo laid over a craft PatternTile. It stays invisible until it has loaded, so the pattern
// is the placeholder while it downloads and the fallback when it fails (offline, blocked).
// Siblings after it style themselves with `peer-data-[loaded=true]:` (white label, scrim).

type CraftPhotoProps = {
  src: string;
  sizes: string;
  /** CSS object-position, to keep the subject inside the tile's crop. */
  position?: string;
  className?: string;
};

export function CraftPhoto({ src, sizes, position, className }: CraftPhotoProps) {
  const [loaded, setLoaded] = useState(false);
  return (
    <Image
      src={src}
      alt=""
      fill
      sizes={sizes}
      data-loaded={loaded}
      // next/image also reports an image that failed before hydration as loaded; a decoded
      // image is the only proof there is something to show.
      onLoad={(event) => setLoaded(event.currentTarget.naturalWidth > 0)}
      style={position ? { objectPosition: position } : undefined}
      className={cn(
        "peer object-cover opacity-0 transition-opacity duration-700 data-[loaded=true]:opacity-100 motion-reduce:transition-none",
        className,
      )}
    />
  );
}
