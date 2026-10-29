"use client";

import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import Link from "next/link";

import { getHasUnread } from "@/lib/api-client/notifications";
import { cn } from "@/lib/utils/cn";

// The bell (P2-07, NTF-02, NTF-03): a link to /notifications with a coral dot while something is
// unread. Checked when a page opens and every 60 s while the tab is visible; a failed check (for
// example before sign-in) simply shows no dot.

export const UNREAD_QUERY_KEY = ["notifications-unread"];
const POLL_MS = 60_000;

export function NotificationBell({
  className,
  iconClassName,
}: {
  className?: string;
  iconClassName?: string;
}) {
  const { data: hasUnread = false } = useQuery({
    queryKey: UNREAD_QUERY_KEY,
    queryFn: getHasUnread,
    staleTime: 0,
    refetchOnMount: "always",
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
    retry: false,
  });
  return (
    <Link
      href="/notifications"
      aria-label={hasUnread ? "Notifications, new" : "Notifications"}
      className={cn("relative flex items-center justify-center rounded-full", className)}
    >
      <Bell aria-hidden className={iconClassName} strokeWidth={1.7} />
      {hasUnread ? (
        <span
          aria-hidden
          className="absolute top-2.5 right-2.5 size-2.5 rounded-full border-2 border-background bg-primary"
        />
      ) : null}
    </Link>
  );
}
