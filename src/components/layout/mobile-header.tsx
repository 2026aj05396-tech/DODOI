import { Bell, Bookmark } from "lucide-react";
import Link from "next/link";

import { ComingSoonBadge } from "@/components/ui/coming-soon";
import { Wordmark } from "@/components/ui/wordmark";

import { ComingSoonTrigger } from "./coming-soon-trigger";
import { HOME, SAVED } from "./nav-items";

/** Top bar on mobile (`1c`): wordmark, Saved, and notifications (coming soon). */
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
        <ComingSoonTrigger
          label="Notifications"
          className="relative flex size-11 items-center justify-center rounded-full text-muted-foreground"
        >
          <Bell aria-hidden className="size-5.5" strokeWidth={1.7} />
          <ComingSoonBadge size="dot" decorative className="absolute top-2.5 right-2.5" />
        </ComingSoonTrigger>
      </div>
    </header>
  );
}
