import Link from "next/link";

import { PatternTile } from "@/components/ui/pattern-tile";
import type { HelpRequestCard } from "@/lib/types/help";
import { timeAgo } from "@/lib/utils/time-ago";

// The "Help request" card in the feed (HLP-03): shown for skills the member can help with, never
// their own request. Blush stripes like the other feed cards, an overline, the title and a link.

export function HelpFeedCard({ request }: { request: HelpRequestCard }) {
  return (
    <section aria-labelledby={`help-card-${request.id}`}>
      <PatternTile accent="blush" className="relative flex flex-col gap-2 p-4.5">
        <p className="text-overline text-foreground uppercase">Help request</p>
        <h2 id={`help-card-${request.id}`} className="text-card-title-web text-foreground">
          {request.title}
        </h2>
        <p className="text-meta text-foreground-secondary">
          {request.skill?.name ? `${request.skill.name} · ` : ""}
          {request.author?.displayName ?? "A maker"} · {timeAgo(request.createdAt)}
        </p>
        <Link
          href={`/community/help/${request.id}`}
          className="mt-1 self-start rounded-sm text-control font-bold text-foreground after:absolute after:inset-0 hover:underline"
        >
          Offer help<span className="sr-only">: {request.title}</span> <span aria-hidden>→</span>
        </Link>
      </PatternTile>
    </section>
  );
}
