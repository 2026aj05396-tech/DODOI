import { Lock } from "lucide-react";
import Link from "next/link";

import { PatternTile, type PatternAccent } from "@/components/ui/pattern-tile";
import type { CollectionSummary } from "@/lib/types/collections";
import { cn } from "@/lib/utils/cn";

// Collection tile (`1i`, UI_UX_GUIDELINES §4 CollectionTile): a 120px mosaic of the 3 newest
// covers (2fr/1fr), the name and "18 saved · Private". Empty slots show craft patterns.

const FILLERS: PatternAccent[] = ["butter", "mint", "blush"];

function Slot({ index, collection }: { index: number; collection: CollectionSummary }) {
  const media = collection.previewMedia[index];
  if (!media)
    return <PatternTile accent={FILLERS[index] ?? "sky"} className="size-full rounded-none" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- Cloudinary serves the sizes in srcSet.
    <img
      src={media.posterUrl ?? media.url}
      srcSet={media.srcSet}
      sizes={index === 0 ? "240px" : "120px"}
      alt=""
      loading="lazy"
      className="size-full bg-muted object-cover"
    />
  );
}

export function CollectionTile({
  collection,
  className,
}: {
  collection: CollectionSummary;
  className?: string;
}) {
  const isPrivate = collection.visibility === "PRIVATE";
  return (
    <Link href={`/saved/${collection.id}`} className={cn("group block rounded-card", className)}>
      <div className="grid h-30 grid-cols-[2fr_1fr] grid-rows-2 gap-0.5 overflow-hidden rounded-card transition-shadow group-hover:shadow-hover">
        <div className="row-span-2">
          <Slot index={0} collection={collection} />
        </div>
        <Slot index={1} collection={collection} />
        <Slot index={2} collection={collection} />
      </div>
      <p className="mt-2 truncate text-card-title text-foreground md:text-card-title-web">
        {collection.name}
      </p>
      <p className="flex items-center gap-1 text-meta text-foreground-secondary md:text-meta-web">
        {collection.itemCount} saved · {isPrivate ? "Private" : "Public"}
        {isPrivate ? <Lock aria-hidden className="size-3" /> : null}
      </p>
    </Link>
  );
}
