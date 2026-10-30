import Link from "next/link";

import { ComingSoonTrigger } from "@/components/layout/coming-soon-trigger";
import { ComingSoonBadge } from "@/components/ui/coming-soon";
import { cn } from "@/lib/utils/cn";

// Community tabs (design `1h`): Your circles · Help requests · Sessions. Help requests is live
// from P3-03; circles (P3-01) and sessions (P3-04) stay coming soon until they are built.

const TAB =
  "relative flex min-h-11 items-center gap-2 border-b-2 px-1 text-control-lg whitespace-nowrap";

export function CommunityTabs() {
  return (
    <nav aria-label="Community" className="overflow-x-auto border-b border-border">
      <ul className="flex gap-7">
        <li>
          <ComingSoonTrigger
            label="Your circles"
            hasVisibleLabel
            className={cn(TAB, "border-transparent text-muted-foreground")}
          >
            Your circles
            <ComingSoonBadge size="dot" decorative className="absolute top-1.5 -right-2.5" />
          </ComingSoonTrigger>
        </li>
        <li>
          <Link
            href="/community"
            aria-current="page"
            className={cn(TAB, "border-foreground font-bold text-foreground")}
          >
            Help requests
          </Link>
        </li>
        <li>
          <ComingSoonTrigger
            label="Sessions"
            hasVisibleLabel
            className={cn(TAB, "border-transparent text-muted-foreground")}
          >
            Sessions
            <ComingSoonBadge size="dot" decorative className="absolute top-1.5 -right-2.5" />
          </ComingSoonTrigger>
        </li>
      </ul>
    </nav>
  );
}
