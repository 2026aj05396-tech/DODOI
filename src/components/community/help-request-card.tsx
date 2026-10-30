import Link from "next/link";

import type { HelpRequestCard as HelpRequestCardData } from "@/lib/types/help";
import { cn } from "@/lib/utils/cn";
import { timeAgo } from "@/lib/utils/time-ago";

// A help request in a list, the rail or the feed (design `1h`): craft chip, status chip (a dot and
// text, never colour alone), the title, "{name} · {age} · {n} replies" and the action.

const STATUS_LABEL = { OPEN: "Open", IN_PROGRESS: "In progress", RESOLVED: "Resolved" } as const;
const STATUS_DOT = {
  OPEN: "bg-success",
  IN_PROGRESS: "bg-butter-strong",
  RESOLVED: "bg-muted-foreground",
} as const;

export function StatusChip({ status }: { status: HelpRequestCardData["status"] }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-meta font-bold text-foreground">
      <span aria-hidden className={cn("size-2 rounded-full", STATUS_DOT[status])} />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function HelpRequestCard({
  request,
  className,
}: {
  request: HelpRequestCardData;
  className?: string;
}) {
  const replies = `${request.responseCount} ${request.responseCount === 1 ? "reply" : "replies"}`;
  const who = request.isOwn ? "You" : (request.author?.displayName ?? "A maker");
  return (
    <article
      className={cn(
        "relative flex flex-col gap-2.5 rounded-card border border-border bg-background p-4 hover:border-border-strong",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        {request.skill ? (
          <span className="rounded-full bg-lavender px-3 py-1 text-meta font-bold text-plum">
            {request.skill.name}
          </span>
        ) : null}
        <StatusChip status={request.status} />
      </div>
      <h3 className="text-card-title-web text-foreground">
        {/* The whole card opens the request; the link text is the title. */}
        <Link
          href={`/community/help/${request.id}`}
          className="rounded-sm after:absolute after:inset-0 after:rounded-card"
        >
          {request.title}
        </Link>
      </h3>
      <div className="flex items-center justify-between gap-3 text-meta text-foreground-secondary">
        <p>
          {who} · {timeAgo(request.createdAt)} · {replies}
        </p>
        <span aria-hidden className="text-control font-bold text-link">
          {request.isOwn || request.status === "RESOLVED" ? "View" : "Offer help"}
        </span>
      </div>
    </article>
  );
}
