import Link from "next/link";

import { PatternTile } from "@/components/ui/pattern-tile";
import type { OwnPostSummary } from "@/lib/types/posts";

// The maker's drafts as a sideways strip (F-17 step 6): under the empty drop area on /create and
// at the top of their own profile's Posts tab. Each opens the draft on Details.

export function DraftsStrip({ drafts, heading }: { drafts: OwnPostSummary[]; heading: string }) {
  if (drafts.length === 0) return null;
  return (
    <section aria-labelledby="drafts-heading" className="flex flex-col gap-3">
      <h2 id="drafts-heading" className="text-section text-foreground">
        {heading}
      </h2>
      <ul className="flex gap-3 overflow-x-auto pb-1">
        {drafts.map((draft) => (
          <li key={draft.id} className="w-28 shrink-0">
            <Link href={`/create/${draft.id}`} className="group flex flex-col gap-1.5 rounded-card">
              <span className="relative block aspect-square overflow-hidden rounded-card bg-muted">
                {draft.coverMedia ? (
                  // eslint-disable-next-line @next/next/no-img-element -- small Cloudinary thumbnail
                  <img
                    src={draft.coverMedia.posterUrl ?? draft.coverMedia.url}
                    alt=""
                    className="size-full object-cover transition duration-200 group-hover:scale-105"
                  />
                ) : (
                  <PatternTile accent="blush" className="size-full rounded-none" />
                )}
                <span className="absolute top-1.5 left-1.5 rounded-full bg-background px-2 py-0.5 text-badge-sm text-foreground uppercase">
                  Draft
                </span>
              </span>
              <span className="truncate text-meta font-bold text-foreground">
                {draft.title === "Untitled" ? "Untitled draft" : draft.title}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
