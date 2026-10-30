"use client";

import { cn } from "@/lib/utils/cn";

import { useUnreadMessages } from "./use-unread-messages";

/** A small coral dot with a screen-reader label when something is waiting in Messages. */
export function UnreadDot({ className }: { className?: string }) {
  const hasUnread = useUnreadMessages();
  if (!hasUnread) return null;
  return (
    <span
      role="img"
      aria-label="New messages"
      className={cn("size-2.5 rounded-full bg-primary", className)}
    />
  );
}
