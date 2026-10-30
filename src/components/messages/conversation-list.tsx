"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Avatar } from "@/components/profile/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { listConversations } from "@/lib/api-client/messages";
import { cn } from "@/lib/utils/cn";
import { timeAgo } from "@/lib/utils/time-ago";

// Your conversations (F-29 step 2, MSG-01): the person, the last line, how long ago, and a dot for
// unread. Phones and tablet show it as the page at `/messages`; from 1280px it is the left pane.

const LIST_POLL_MS = 60_000;

export function ConversationList({ className }: { className?: string }) {
  const pathname = usePathname();
  const query = useInfiniteQuery({
    queryKey: ["conversations", "list"],
    queryFn: ({ pageParam }) => listConversations(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    refetchInterval: LIST_POLL_MS,
    refetchIntervalInBackground: false,
    // A conversation that was just opened or written in moves up when the address changes.
    staleTime: 0,
  });
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <nav
      aria-label="Your conversations"
      className={cn(
        "flex flex-col gap-4 px-5 pt-4 pb-8 md:px-7 md:pt-8 xl:px-5 xl:pt-8",
        className,
      )}
    >
      <h1 className="text-title text-foreground md:text-title-web xl:text-title">Messages</h1>

      {query.isPending ? (
        <div role="status" aria-label="Loading your conversations" className="flex flex-col gap-2">
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="h-18 w-full" />
          ))}
        </div>
      ) : query.isError && items.length === 0 ? (
        <ErrorState
          message="We couldn't load your messages."
          onRetry={() => void query.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<MessageCircle />}
          title="No messages yet"
          description="Start one from a maker's profile, or from a reply to your help request."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((conversation) => {
            const isActive = pathname === `/messages/${conversation.id}`;
            const name = conversation.with?.displayName ?? "A maker";
            const last = conversation.lastMessage;
            return (
              <li key={conversation.id}>
                <Link
                  href={`/messages/${conversation.id}`}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex min-h-16 items-center gap-3 rounded-card border px-4 py-2.5",
                    isActive
                      ? "border-foreground bg-blush"
                      : "border-border bg-background hover:bg-muted",
                  )}
                >
                  <Avatar url={conversation.with?.avatarUrl ?? null} className="size-10 shrink-0" />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span
                      className={cn(
                        "truncate text-control-lg text-foreground",
                        conversation.hasUnread ? "font-bold" : "font-medium",
                      )}
                    >
                      {name}
                    </span>
                    <span className="truncate text-meta text-foreground-secondary">
                      {last
                        ? `${last.isOwn ? "You: " : ""}${last.body ?? "Message deleted"} · ${timeAgo(last.createdAt)}`
                        : "No messages"}
                    </span>
                  </span>
                  {conversation.hasUnread ? (
                    <span
                      role="img"
                      aria-label="Unread"
                      className="size-2.5 shrink-0 rounded-full bg-primary"
                    />
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {query.hasNextPage ? (
        <Button
          variant="outline"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          {query.isFetchingNextPage ? "Loading…" : "Show more"}
        </Button>
      ) : null}
    </nav>
  );
}
