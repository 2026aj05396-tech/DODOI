import Link from "next/link";

import { NotificationBell } from "@/components/notifications/notification-bell";
import { SearchBox } from "@/components/search/search-box";

// Feed header from 768px (`3c`: search + avatar; `2b`: search, bell, avatar). The bell is
// live from P2-07; the avatar opens your profile. Mobile uses the app shell's header (`1c`) and the Explore tab for search.

export function FeedHeader({ initial }: { initial: string }) {
  return (
    <div className="hidden items-center gap-3 md:flex">
      <SearchBox appearance="outline" className="min-w-0 flex-1" />
      <NotificationBell
        className="size-11.5 border border-border bg-background hover:bg-muted"
        iconClassName="size-5"
      />
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
