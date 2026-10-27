"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import type { Paginated } from "@/lib/types/api";
import type { PostCard as PostCardData } from "@/lib/types/posts";

import { Masonry, cardHeight } from "./masonry";
import { MasonrySkeleton } from "./masonry-skeleton";
import { PostCard } from "./post-card";

// A paged masonry of post cards with "Load more" (skill page, theme page, search Posts tab).

export function InfinitePostGrid({
  queryKey,
  fetchPage,
  initialPage,
  empty,
}: {
  queryKey: readonly unknown[];
  fetchPage: (cursor: string | null) => Promise<Paginated<PostCardData>>;
  /** Server-loaded first page; without it the first page loads in the browser. */
  initialPage?: Paginated<PostCardData>;
  /** Shown when there are no posts at all. */
  empty: ReactNode;
}) {
  const posts = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    initialData: initialPage ? { pages: [initialPage], pageParams: [null] } : undefined,
  });

  if (posts.isPending) return <MasonrySkeleton />;
  if (posts.isError && !posts.isFetchNextPageError) {
    return (
      <ErrorState message="We couldn't load these posts." onRetry={() => void posts.refetch()} />
    );
  }
  const items = posts.data.pages.flatMap((page) => page.items);
  if (items.length === 0) return <>{empty}</>;

  return (
    <div className="flex flex-col gap-4">
      <Masonry
        items={items}
        getKey={(post) => post.id}
        getHeight={(post) => cardHeight(post.coverMedia.width, post.coverMedia.height)}
        renderItem={(post, { isAboveFold }) => (
          <PostCard post={post} isSignedIn isAboveFold={isAboveFold} />
        )}
      />
      {posts.isFetchingNextPage ? <MasonrySkeleton label="Loading more posts" /> : null}
      {posts.isFetchNextPageError ? (
        <ErrorState
          message="We couldn't load more posts."
          onRetry={() => void posts.fetchNextPage({ cancelRefetch: false })}
        />
      ) : posts.hasNextPage && !posts.isFetchingNextPage ? (
        <Button
          variant="outline"
          className="self-center"
          onClick={() => void posts.fetchNextPage({ cancelRefetch: false })}
        >
          Load more
        </Button>
      ) : null}
    </div>
  );
}
