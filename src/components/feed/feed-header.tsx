import { Bell } from "lucide-react";
import Link from "next/link";

import { ComingSoonTrigger } from "@/components/layout/coming-soon-trigger";
import { SearchBox } from "@/components/search/search-box";
import { ComingSoonBadge } from "@/components/ui/coming-soon";

// Feed header from 768px (`3c`: search + avatar; `2b`: search, bell, avatar). Notifications are
// Phase 2; the avatar opens your profile. Mobile uses the app shell's header (`1c`) and the Explore tab for search.

export function FeedHeader({ initial }: { initial: string }) {
  return (
    <div className="hidden items-center gap-3 md:flex">
      <SearchBox appearance="outline" className="min-w-0 flex-1" />
      <ComingSoonTrigger
        label="Notifications"
        className="relative hidden size-11.5 items-center justify-center rounded-full border border-border bg-background text-muted-foreground xl:flex"
      >
        <Bell aria-hidden className="size-5" strokeWidth={1.7} />
        <ComingSoonBadge size="dot" decorative className="absolute top-2.5 right-2.5" />
      </ComingSoonTrigger>
      <Link
        href="/profile"
        aria-label="Your profile"
        className="flex size-11.5 items-center justify-center rounded-full bg-blush text-control font-bold text-foreground"
      >
        <span aria-hidden>{initial}</span>
      </Link>
    </div>
  );
}
