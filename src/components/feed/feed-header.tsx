import { Bell, Search } from "lucide-react";

import { ComingSoonTrigger } from "@/components/layout/coming-soon-trigger";
import { ComingSoonBadge } from "@/components/ui/coming-soon";

// Feed header from 768px (`3c`: search + avatar; `2b`: search, bell, avatar). Search arrives with
// P1-23/P1-26 and profiles with P1-14, so both are "coming soon" for now (PO decision, P1-22);
// mobile uses the app shell's header (`1c`).

export function FeedHeader({ initial }: { initial: string }) {
  return (
    <div className="hidden items-center gap-3 md:flex">
      <ComingSoonTrigger
        label="Search skills, projects, makers"
        hasVisibleLabel
        className="flex h-11.5 min-w-0 flex-1 items-center gap-2.5 rounded-full border border-border bg-background px-4 text-left text-control text-muted-foreground"
      >
        <Search aria-hidden className="size-4.5 shrink-0" strokeWidth={1.8} />
        <span className="truncate">Search skills, projects, makers</span>
        <ComingSoonBadge size="sm" decorative className="ml-auto" />
      </ComingSoonTrigger>
      <ComingSoonTrigger
        label="Notifications"
        className="relative hidden size-11.5 items-center justify-center rounded-full border border-border bg-background text-muted-foreground xl:flex"
      >
        <Bell aria-hidden className="size-5" strokeWidth={1.7} />
        <ComingSoonBadge size="dot" decorative className="absolute top-2.5 right-2.5" />
      </ComingSoonTrigger>
      <ComingSoonTrigger
        label="Your profile"
        className="relative flex size-11.5 items-center justify-center rounded-full bg-blush text-control font-bold text-foreground"
      >
        <span aria-hidden>{initial}</span>
        <ComingSoonBadge size="dot" decorative className="absolute top-0.5 right-0.5" />
      </ComingSoonTrigger>
    </div>
  );
}
