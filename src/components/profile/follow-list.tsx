"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Skeleton } from "@/components/ui/skeleton";
import { listFollows } from "@/lib/api-client/follows";

import { Avatar } from "./avatar";
import { FollowButton } from "./follow-button";

// The owner's Followers and Following lists (FLW-03, F-20 step 3): newest first, 20 at a time.
// People you follow have a Following button, so unfollowing is one tap away.

export function FollowList({ list }: { list: "followers" | "following" }) {
  const query = useInfiniteQuery({
    queryKey: ["follows", list],
    queryFn: ({ pageParam }) => listFollows(list, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    staleTime: 0,
  });
  const people = query.data?.pages.flatMap((page) => page.items) ?? [];

  if (query.isPending) {
    return (
      <div role="status" aria-label="Loading" className="flex flex-col gap-3">
        <Skeleton className="h-14 w-full rounded-md" />
        <Skeleton className="h-14 w-full rounded-md" />
        <Skeleton className="h-14 w-full rounded-md" />
      </div>
    );
  }
  if (query.isError && people.length === 0) {
    return (
      <ErrorBanner role="alert" className="flex items-center justify-between gap-3">
        <span>We couldn&apos;t load this list.</span>
        <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
          Try again
        </Button>
      </ErrorBanner>
    );
  }
  if (people.length === 0) {
    return (
      <EmptyState
        title={list === "followers" ? "No followers yet" : "You're not following anyone yet"}
        description={
          list === "followers"
            ? "When someone follows you, they will show up here."
            : "Follow makers from their profile or a post to see their posts in your feed."
        }
      />
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col">
        {people.map((person) => (
          <li
            key={person.username}
            className="flex items-center gap-3 border-b border-border-faint py-3"
          >
            <Link
              href={`/u/${person.username}`}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-sm hover:underline"
            >
              <Avatar url={person.avatarUrl} className="size-11 shrink-0" />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-body font-bold text-foreground">
                  {person.displayName}
                </span>
                <span className="truncate text-meta text-foreground-secondary">
                  @{person.username}
                </span>
              </span>
            </Link>
            {list === "following" ? (
              <FollowButton
                username={person.username}
                displayName={person.displayName}
                initialFollowing
                isSignedIn
                returnTo="/profile/following"
              />
            ) : null}
          </li>
        ))}
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
