import Link from "next/link";

import { PATTERN_ACCENTS, PatternTile } from "@/components/ui/pattern-tile";
import type { ThemeSummary } from "@/lib/types/posts";
import { cn } from "@/lib/utils/cn";

// Theme card (`1d`, UI_UX_GUIDELINES §4 ThemeCard): 180×160 patterned tile (or the theme's cover),
// "12 ideas" overline and the title; lifts and tilts slightly on hover.

export function ThemeCard({
  theme,
  index,
  className,
}: {
  theme: ThemeSummary;
  /** Picks the pattern when there is no cover. */
  index: number;
  className?: string;
}) {
  const accent = PATTERN_ACCENTS[index % PATTERN_ACCENTS.length] ?? "butter";
  return (
    <Link
      href={`/t/${theme.slug}`}
      className={cn(
        "group relative block h-40 w-45 shrink-0 overflow-hidden rounded-card transition-transform duration-200 hover:-translate-y-0.5 hover:-rotate-[1.5deg] motion-reduce:transition-none motion-reduce:hover:transform-none",
        className,
      )}
    >
      {theme.coverMedia ? (
        // eslint-disable-next-line @next/next/no-img-element -- Cloudinary serves the sizes in srcSet.
        <img
          src={theme.coverMedia.url}
          srcSet={theme.coverMedia.srcSet}
          sizes="180px"
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <PatternTile accent={accent} className="absolute inset-0 rounded-none" />
      )}
      <span className="relative flex h-full flex-col justify-between p-4">
        <span
          className={cn(
            "self-start text-overline text-foreground uppercase",
            theme.coverMedia && "rounded-full bg-background/85 px-2 py-0.5",
          )}
        >
          {theme.postCount} {theme.postCount === 1 ? "idea" : "ideas"}
        </span>
        <span
          className={cn(
            "text-card-title-web text-foreground",
            theme.coverMedia && "rounded-md bg-background/85 px-2 py-1",
          )}
        >
          {theme.title}
        </span>
      </span>
    </Link>
  );
}
