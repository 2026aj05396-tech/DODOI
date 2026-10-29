"use client";

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";

import { Avatar } from "@/components/profile/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Skeleton } from "@/components/ui/skeleton";
import { showToast } from "@/components/ui/toast";
import { listBlocks, unblockUser } from "@/lib/api-client/blocks";
import { ApiRequestError } from "@/lib/api-client/request";

// Blocked accounts (MOD-02, F-22 step 3): everyone you blocked, with Unblock. Unblocking does not
// bring back follows or notifications that were removed.

export function BlockedList() {
  const queryClient = useQueryClient();
  const query = useInfiniteQuery({
    queryKey: ["blocks"],
    queryFn: ({ pageParam }) => listBlocks(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    staleTime: 0,
  });
  const people = query.data?.pages.flatMap((page) => page.items) ?? [];

  async function unblock(username: string) {
    try {
      await unblockUser(username);
      showToast({ message: `Unblocked @${username}` });
      await queryClient.invalidateQueries({ queryKey: ["blocks"] });
    } catch (error) {
      showToast({
        message: error instanceof ApiRequestError ? error.message : "We couldn't unblock them.",
      });
    }
  }

  if (query.isPending) {
    return (
      <div role="status" aria-label="Loading" className="flex flex-col gap-3">
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
        title="You haven't blocked anyone"
        description="People you block can't see your profile, posts or comments, and you can't see theirs."
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
            <Avatar url={null} className="size-11 shrink-0" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-body font-bold text-foreground">
                {person.displayName}
              </span>
              <span className="truncate text-meta text-foreground-secondary">
                @{person.username}
              </span>
            </span>
            <Button
              variant="outline"
              size="sm"
              aria-label={`Unblock ${person.displayName}`}
              onClick={() => void unblock(person.username)}
            >
              Unblock
            </Button>
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
