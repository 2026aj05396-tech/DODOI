"use client";

import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { HelpFeedCard } from "@/components/community/help-feed-card";
import { Masonry, cardHeight } from "@/components/posts/masonry";
import { MasonrySkeleton } from "@/components/posts/masonry-skeleton";
import { PostCard } from "@/components/posts/post-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { showToast } from "@/components/ui/toast";
import { getFeedPage, markNotInterested, undoNotInterested } from "@/lib/api-client/feed";
import { ApiRequestError } from "@/lib/api-client/request";
import type { FeedFilter } from "@/lib/schemas/feed";
import type { FeedFilterChip, FeedItem, FeedPage } from "@/lib/types/feed";

import { EmptyFeedArt } from "./empty-feed-art";
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
  if (item.kind === "post") return item.post.id;
  if (item.kind === "help_request") return `help-${item.request.id}`;
  return `suggestion-${item.skill.id}`;
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
  if (filter === "following") {
    return {
      title: "No new posts from people you follow",
      description: "When they share something new, it will show up here.",
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
  const [filter, setFilter] = useState<FeedFilter>("for-you");
  // The server's first page is used once; after any switch every filter starts a new session.
  const [useServerPage, setUseServerPage] = useState(true);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  // The server's cards are there from the first paint, so only later cards fade in: an image at
  // opacity 0 doesn't count as painted, which held back the page's largest paint by ~550 ms (P1-31).
  const [serverPostIds] = useState(
    () =>
      new Set(initialPage.items.flatMap((item) => (item.kind === "post" ? [item.post.id] : []))),
  );
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
      return true;
    });

  let body: React.ReactNode;
  if (feed.isPending) {
    body = <MasonrySkeleton />;
  } else if (feed.isError && !isFetchNextPageError) {
    body = <ErrorState message="We couldn't load your feed." onRetry={() => void feed.refetch()} />;
  } else if (items.length === 0) {
    const message = emptyMessage(filter, chips);
    body = (
      <EmptyState
        icon={<EmptyFeedArt />}
        title={message.title}
        titleAs="h2"
        description={message.description}
        action={
          <Button asChild>
            <Link href="/explore">Explore crafts</Link>
          </Button>
        }
      />
    );
  } else {
    body = (
      <>
        {/* Keeps headings in order (h1 greeting → h2 → card h3) when the suggestion card's h2
            moves to the rail from 1280px. */}
        <h2 className="sr-only">Posts</h2>
        <Masonry
          items={items}
          // From 1280px both cards sit in the right rail instead (`2b`).
          include={(item, columns) =>
            !((item.kind === "skill_suggestion" || item.kind === "help_request") && columns === 3)
          }
          getKey={itemKey}
          getHeight={itemHeight}
          renderItem={(item, { isAboveFold }) => {
            if (item.kind === "skill_suggestion") return <SkillSuggestionCard suggestion={item} />;
            if (item.kind === "help_request") return <HelpFeedCard request={item.request} />;
            const { post } = item;
            if (hidden.has(post.id)) {
              return <HiddenCard onUndo={() => undoHide(post.id)} />;
            }
            return (
              <PostCard
                post={post}
                isSignedIn
                isAboveFold={isAboveFold}
                className={serverPostIds.has(post.id) ? undefined : "animate-dd-up"}
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
