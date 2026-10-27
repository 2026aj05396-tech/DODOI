"use client";

import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

import { Masonry, cardHeight } from "@/components/posts/masonry";
import { MasonrySkeleton } from "@/components/posts/masonry-skeleton";
import { PostCard } from "@/components/posts/post-card";
import { useColumnCount } from "@/components/posts/use-column-count";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { showToast } from "@/components/ui/toast";
import { getFeedPage, markNotInterested, undoNotInterested } from "@/lib/api-client/feed";
import { ApiRequestError } from "@/lib/api-client/request";
import type { FeedFilter } from "@/lib/schemas/feed";
import type { FeedFilterChip, FeedItem, FeedPage } from "@/lib/types/feed";

import { FilterBar } from "./filter-bar";
import { HiddenCard } from "./hidden-card";
import { PostMenu } from "./post-menu";
import { SkillSuggestionCard } from "./skill-suggestion-card";

// Home feed (P1-22; FEED-01…14; `1c`, `2b`, `3c`). The first For you page comes from the server;
// later pages load when the end comes near (with a "Load more" button for keyboard and screen
// reader users, FEED-07). Each filter is its own feed session (FEED-13): switching filters starts
// fresh. Cards are placed in the shortest column, so a new page never moves earlier cards.

/** "Hidden. Undo" stays this long, then the card is gone (USER_FLOWS F-06). */
const UNDO_MS = 6000;

function itemKey(item: FeedItem): string {
  return item.kind === "post" ? item.post.id : `suggestion-${item.skill.id}`;
}

/** Relative height of an item, for picking the shortest column. */
function itemHeight(item: FeedItem): number {
  if (item.kind !== "post") return 0.9;
  return cardHeight(item.post.coverMedia.width, item.post.coverMedia.height);
}

function emptyMessage(filter: string, chips: FeedFilterChip[]) {
  if (filter === "new-to-you") {
    return {
      title: "You've seen everything new for now",
      description: "Check back soon: new projects are added every week.",
    };
  }
  if (filter.startsWith("skill:")) {
    const label = chips.find((chip) => chip.key === filter)?.label ?? "this skill";
    return {
      title: `No ${label} posts yet`,
      description: "Try For you or New to you in the meantime.",
    };
  }
  return {
    title: "Nothing to show yet",
    description: "New projects are added every week. Check back soon.",
  };
}

export function HomeFeed({
  chips,
  initialPage,
}: {
  chips: FeedFilterChip[];
  initialPage: FeedPage;
}) {
  const queryClient = useQueryClient();
  const columnCount = useColumnCount();
  const [filter, setFilter] = useState<FeedFilter>("for-you");
  // The server's first page is used once; after any switch every filter starts a new session.
  const [useServerPage, setUseServerPage] = useState(true);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const sentinel = useRef<HTMLDivElement>(null);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const feed = useInfiniteQuery({
    queryKey: ["feed", filter],
    queryFn: ({ pageParam }) => getFeedPage(filter, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    initialData:
      useServerPage && filter === "for-you"
        ? { pages: [initialPage], pageParams: [null] }
        : undefined,
    staleTime: Infinity,
  });
  const { hasNextPage, isFetchingNextPage, isFetchNextPageError } = feed;
  // Never cancel a page request in flight: the server has already counted its posts as served, so
  // asking again would come back empty (scroll and "Load more" can fire together).
  const fetchNextPage = feed.fetchNextPage;
  const loadMore = useCallback(() => void fetchNextPage({ cancelRefetch: false }), [fetchNextPage]);

  function restart(next: FeedFilter) {
    setUseServerPage(false);
    void queryClient.removeQueries({ queryKey: ["feed", next] });
    setFilter(next);
  }

  // A session older than 24 hours (or a stale cursor) starts the same filter again.
  const nextPageError = isFetchNextPageError ? feed.error : null;
  const isExpired =
    nextPageError instanceof ApiRequestError && nextPageError.code === "FEED_SESSION_EXPIRED";

  // Load the next page when the end of the feed comes near.
  useEffect(() => {
    const element = sentinel.current;
    if (!element || !hasNextPage || isFetchNextPageError) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) loadMore();
      },
      { rootMargin: "800px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [loadMore, hasNextPage, isFetchNextPageError]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => clearTimeout(timer));
  }, []);

  // Hide and undo share a scope, so they reach the server in the order they were tapped.
  const hide = useMutation({
    mutationFn: markNotInterested,
    scope: { id: "feed-feedback" },
    onError: (_error, postId) => {
      clearTimeout(timers.current.get(postId));
      setHidden((current) => withoutId(current, postId));
      showToast({ message: "We couldn't hide that post. Try again." });
    },
  });
  const undo = useMutation({
    mutationFn: undoNotInterested,
    scope: { id: "feed-feedback" },
    onError: (_error, postId) => {
      setHidden((current) => new Set(current).add(postId));
      showToast({ message: "We couldn't undo that. Try again." });
    },
  });

  function notInterested(postId: string) {
    setHidden((current) => new Set(current).add(postId));
    timers.current.set(
      postId,
      setTimeout(() => setDismissed((current) => new Set(current).add(postId)), UNDO_MS),
    );
    hide.mutate(postId);
  }

  function undoHide(postId: string) {
    clearTimeout(timers.current.get(postId));
    setHidden((current) => withoutId(current, postId));
    undo.mutate(postId);
  }

  const seen = new Set<string>();
  const items = (feed.data?.pages ?? [])
    .flatMap((page) => page.items)
    .filter((item) => {
      const key = itemKey(item);
      if (seen.has(key) || dismissed.has(key)) return false;
      seen.add(key);
      // From 1280px the suggestion sits in the right rail instead (`2b`).
      return !(item.kind === "skill_suggestion" && columnCount === 3);
    });

  let body: React.ReactNode;
  if (feed.isPending || columnCount === null) {
    body = <MasonrySkeleton />;
  } else if (feed.isError && !isFetchNextPageError) {
    body = <ErrorState message="We couldn't load your feed." onRetry={() => void feed.refetch()} />;
  } else if (items.length === 0) {
    const message = emptyMessage(filter, chips);
    body = <EmptyState title={message.title} titleAs="h2" description={message.description} />;
  } else {
    body = (
      <>
        <Masonry
          items={items}
          columns={columnCount}
          getKey={itemKey}
          getHeight={itemHeight}
          renderItem={(item) => {
            if (item.kind === "skill_suggestion") return <SkillSuggestionCard suggestion={item} />;
            const { post } = item;
            if (hidden.has(post.id)) {
              return <HiddenCard onUndo={() => undoHide(post.id)} />;
            }
            return (
              <PostCard
                post={post}
                isSignedIn
                className="animate-dd-up"
                menu={
                  <PostMenu
                    postId={post.id}
                    postTitle={post.title}
                    onNotInterested={() => notInterested(post.id)}
                  />
                }
              />
            );
          }}
        />
        <div ref={sentinel} />
        <div className="flex flex-col items-center gap-3 pt-6 pb-4">
          {isFetchingNextPage ? <MasonrySkeleton label="Loading more posts" /> : null}
          {isExpired ? (
            <ErrorState
              message="This feed has expired."
              retryLabel="Refresh the feed"
              onRetry={() => restart(filter)}
            />
          ) : nextPageError ? (
            <ErrorState message="We couldn't load more posts." onRetry={loadMore} />
          ) : hasNextPage && !isFetchingNextPage ? (
            <Button variant="outline" onClick={loadMore}>
              Load more
            </Button>
          ) : !hasNextPage ? (
            <p className="text-body text-foreground-secondary">
              You&apos;re all caught up. Check back soon for new projects.
            </p>
          ) : null}
        </div>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <FilterBar chips={chips} active={filter} onChange={(key) => restart(key as FeedFilter)} />
      <section aria-label="Your feed" aria-busy={feed.isFetching}>
        {body}
      </section>
    </div>
  );
}

function withoutId(ids: Set<string>, id: string): Set<string> {
  const next = new Set(ids);
  next.delete(id);
  return next;
}
