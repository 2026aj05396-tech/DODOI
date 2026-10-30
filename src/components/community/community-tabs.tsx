import Link from "next/link";

import { cn } from "@/lib/utils/cn";

// Community tabs (design `1h`): Your circles · Help requests · Sessions. All three are live: circles
// from P3-01, help requests from P3-03, sessions from P3-04.

const TAB =
  "relative flex min-h-11 items-center gap-2 border-b-2 px-1 text-control-lg whitespace-nowrap";
const ACTIVE = "border-foreground font-bold text-foreground";
const IDLE = "border-transparent text-muted-foreground hover:text-foreground";

export function CommunityTabs({ active }: { active: "circles" | "help" | "sessions" }) {
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
          <Link
            href="/community/sessions"
            aria-current={active === "sessions" ? "page" : undefined}
            className={cn(TAB, active === "sessions" ? ACTIVE : IDLE)}
          >
            Sessions
          </Link>
        </li>
      </ul>
    </nav>
  );
}
