import { Bookmark } from "lucide-react";
import Link from "next/link";

import { NotificationBell } from "@/components/notifications/notification-bell";
import { Wordmark } from "@/components/ui/wordmark";

import { HOME, SAVED } from "./nav-items";

/** Top bar on mobile (`1c`): wordmark, Saved, and notifications (P2-07). */
export function MobileHeader() {
  return (
    <header className="flex items-center justify-between px-5 pt-2 md:hidden">
      <Link href={HOME.href ?? "/"} className="rounded-sm">
        <Wordmark className="text-2xl" />
      </Link>
      <div className="flex items-center gap-1 text-foreground">
        <Link
          href={SAVED.href ?? "/saved"}
          aria-label="Saved"
          className="flex size-11 items-center justify-center rounded-full hover:bg-muted"
        >
          <Bookmark aria-hidden className="size-5.5" strokeWidth={1.7} />
        </Link>
        <NotificationBell className="size-11 hover:bg-muted" iconClassName="size-5.5" />
      </div>
    </header>
  );
}
