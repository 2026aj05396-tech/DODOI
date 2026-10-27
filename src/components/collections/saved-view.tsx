"use client";

import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Masonry, cardHeight } from "@/components/posts/masonry";
import { MasonrySkeleton } from "@/components/posts/masonry-skeleton";
import { PostCard } from "@/components/posts/post-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { createCollection, getMyCollections, getSavedPosts } from "@/lib/api-client/collections";
import type { Paginated } from "@/lib/types/api";
import type { CollectionSummary } from "@/lib/types/collections";
import type { PostCard as PostCardData } from "@/lib/types/posts";

import { CollectionNameDialog } from "./collection-name-dialog";
import { COLLECTIONS_KEY } from "./collection-picker";
import { CollectionTile } from "./collection-tile";

// Saved (`/saved`, COLL-05; not designed, built from the system; PO decision P1-25): the user's
// collections first (tiles as in `1i`, sideways on mobile), then "All saved", most recent first.

export const SAVES_KEY = ["saves"] as const;

export function SavedView({
  initialCollections,
  initialSaves,
}: {
  initialCollections: CollectionSummary[];
  initialSaves: Paginated<PostCardData>;
}) {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);

  const collections = useQuery({
    queryKey: COLLECTIONS_KEY,
    queryFn: getMyCollections,
    initialData: initialCollections,
  });
  const saves = useInfiniteQuery({
    queryKey: SAVES_KEY,
    queryFn: ({ pageParam }) => getSavedPosts(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    initialData: { pages: [initialSaves], pageParams: [null] },
  });
  const posts = saves.data.pages.flatMap((page) => page.items);

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="collections-heading" className="flex flex-col gap-3">
        <h2 id="collections-heading" className="text-section text-foreground">
          Collections
        </h2>
        <ul className="-mx-5 flex scrollbar-none gap-3 overflow-x-auto px-5 pb-1 md:mx-0 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible md:px-0 lg:grid-cols-4">
          {collections.data.map((collection) => (
            <li key={collection.id} className="w-40 shrink-0 md:w-auto">
              <CollectionTile collection={collection} />
            </li>
          ))}
          <li className="w-40 shrink-0 md:w-auto">
            <button
              type="button"
              onClick={() => setIsCreating(true)}
              className="flex h-30 w-full items-center justify-center gap-1.5 rounded-card border-control border-dashed border-border-faint text-control text-foreground-secondary hover:bg-muted"
            >
              <Plus aria-hidden className="size-4.5" />
              New collection
            </button>
          </li>
        </ul>
      </section>

      <section aria-labelledby="all-saved-heading" className="flex flex-col gap-3">
        <h2 id="all-saved-heading" className="text-section text-foreground">
          All saved
        </h2>
        {posts.length === 0 && !saves.hasNextPage ? (
          <EmptyState
            title="Nothing saved yet"
            titleAs="h3"
            description="Tap the bookmark on any post to keep it here."
            action={
              <Button asChild>
                <Link href="/feed">Go to your feed</Link>
              </Button>
            }
          />
        ) : (
          <Masonry
            items={posts}
            getKey={(post) => post.id}
            getHeight={(post) => cardHeight(post.coverMedia.width, post.coverMedia.height)}
            renderItem={(post, { isAboveFold }) => (
              <PostCard post={post} isSignedIn isAboveFold={isAboveFold} />
            )}
          />
        )}
        {saves.isFetchingNextPage ? <MasonrySkeleton label="Loading more saved posts" /> : null}
        {saves.isFetchNextPageError ? (
          <ErrorState
            message="We couldn't load more saved posts."
            onRetry={() => void saves.fetchNextPage({ cancelRefetch: false })}
          />
        ) : saves.hasNextPage && !saves.isFetchingNextPage ? (
          <Button
            variant="outline"
            className="self-center"
            onClick={() => void saves.fetchNextPage({ cancelRefetch: false })}
          >
            Load more
          </Button>
        ) : null}
      </section>

      <CollectionNameDialog
        open={isCreating}
        onOpenChange={setIsCreating}
        title="New collection"
        description="New collections are private. You can make them public later."
        submitLabel="Create collection"
        onSubmit={async (name) => {
          await createCollection(name);
          await queryClient.invalidateQueries({ queryKey: COLLECTIONS_KEY });
        }}
      />
    </div>
  );
}
