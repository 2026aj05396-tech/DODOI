import { MessageSquare } from "lucide-react";
import Link from "next/link";

import { UnreadDot } from "@/components/messages/unread-dot";

// The Community title with a Messages link on phones (F-29: "phones: from Community"); tablet and
// desktop reach Messages from the rail and the sidebar.

export function CommunityHeader() {
  return (
    <div className="flex items-center justify-between gap-3">
      <h1 className="text-greeting text-foreground md:text-greeting-web">Community</h1>
      <Link
        href="/messages"
        className="relative flex min-h-11 items-center gap-2 rounded-full border border-border px-4 text-control font-bold text-foreground hover:bg-muted md:hidden"
      >
        <MessageSquare aria-hidden className="size-4.5" />
        Messages
        <UnreadDot className="absolute top-2 right-2" />
      </Link>
    </div>
  );
}
