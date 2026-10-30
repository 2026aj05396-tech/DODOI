import Link from "next/link";

import { ComingSoonTrigger } from "@/components/layout/coming-soon-trigger";
import { ComingSoonBadge } from "@/components/ui/coming-soon";
import { cn } from "@/lib/utils/cn";

// Community tabs (design `1h`): Your circles · Help requests · Sessions. Your circles is live from
// P3-01 and Help requests from P3-03; sessions (P3-04) stays coming soon until it is built.

const TAB =
  "relative flex min-h-11 items-center gap-2 border-b-2 px-1 text-control-lg whitespace-nowrap";
const ACTIVE = "border-foreground font-bold text-foreground";
const IDLE = "border-transparent text-muted-foreground hover:text-foreground";

export function CommunityTabs({ active }: { active: "circles" | "help" }) {
  return (
    <nav aria-label="Community" className="overflow-x-auto border-b border-border">
      <ul className="flex gap-7">
        <li>
          <Link
            href="/community/circles"
            aria-current={active === "circles" ? "page" : undefined}
            className={cn(TAB, active === "circles" ? ACTIVE : IDLE)}
          >
            Your circles
          </Link>
        </li>
        <li>
          <Link
            href="/community"
            aria-current={active === "help" ? "page" : undefined}
            className={cn(TAB, active === "help" ? ACTIVE : IDLE)}
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
