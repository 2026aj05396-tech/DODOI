"use client";

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { Avatar } from "@/components/profile/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Skeleton } from "@/components/ui/skeleton";
import { listNotifications, markAllRead } from "@/lib/api-client/notifications";
import { cn } from "@/lib/utils/cn";
import { notificationHref, notificationText } from "@/lib/utils/notification-text";
import { relativeDay } from "@/lib/utils/relative-day";

import { UNREAD_QUERY_KEY } from "./notification-bell";

// /notifications (P2-07, NTF-02, F-21): newest first, unread ones marked until the list has been
// seen; opening the list marks everything read and clears the bell's dot.

export function NotificationList() {
  const queryClient = useQueryClient();
  const query = useInfiniteQuery({
    queryKey: ["notifications"],
    queryFn: ({ pageParam }) => listNotifications(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    staleTime: 0,
    refetchOnMount: "always",
  });
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];

  // Mark read once per visit, after the list (with its unread marks) has been fetched.
  const hasMarked = useRef(false);
  const isLoaded = query.isSuccess;
  useEffect(() => {
    if (!isLoaded || hasMarked.current) return;
    hasMarked.current = true;
    void markAllRead()
      .then(() => queryClient.setQueryData(UNREAD_QUERY_KEY, false))
      .catch(() => undefined);
  }, [isLoaded, queryClient]);

  if (query.isPending) {
    return (
      <div role="status" aria-label="Loading" className="flex flex-col gap-3">
        <Skeleton className="h-16 w-full rounded-md" />
        <Skeleton className="h-16 w-full rounded-md" />
        <Skeleton className="h-16 w-full rounded-md" />
      </div>
    );
  }
  if (query.isError && items.length === 0) {
    return (
      <ErrorBanner role="alert" className="flex items-center justify-between gap-3">
        <span>We couldn&apos;t load your notifications.</span>
        <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
          Try again
        </Button>
      </ErrorBanner>
    );
  }
  if (items.length === 0) {
    return (
      <EmptyState
        title="Nothing new yet"
        description="Comments, replies, likes and new followers will show up here."
      />
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col">
        {items.map((item) => {
          const href = notificationHref(item);
          const row = (
            <>
              <Avatar url={item.actors[0]?.avatarUrl ?? null} className="size-11 shrink-0" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-body text-foreground">{notificationText(item)}</span>
                <span className="text-meta text-foreground-secondary">
                  {relativeDay(item.createdAt)}
                </span>
              </span>
              {item.isUnread ? (
                <>
                  <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-primary" />
                  <span className="sr-only">New</span>
                </>
              ) : null}
            </>
          );
          const style = cn(
            "flex items-center gap-3 border-b border-border-faint px-2 py-3",
            item.isUnread && "bg-card",
          );
          return (
            <li key={item.id}>
              {href ? (
                <Link href={href} className={cn(style, "hover:bg-muted")}>
                  {row}
                </Link>
              ) : (
                <div className={style}>{row}</div>
              )}
            </li>
          );
        })}
      </ul>
      {query.hasNextPage ? (
        <Button
          variant="outline"
          className="self-center"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          {query.isFetchingNextPage ? "Loading…" : "Show more"}
        </Button>
      ) : null}
    </div>
  );
}
