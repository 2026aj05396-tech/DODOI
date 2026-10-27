"use client";

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FolderMinus, Globe, Lock, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DropdownMenu } from "radix-ui";
import { useState } from "react";

import { Masonry, cardHeight } from "@/components/posts/masonry";
import { MasonrySkeleton } from "@/components/posts/masonry-skeleton";
import { PostCard } from "@/components/posts/post-card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { showToast } from "@/components/ui/toast";
import {
  addToCollection,
  deleteCollection,
  getCollectionPage,
  removeFromCollection,
  updateCollection,
} from "@/lib/api-client/collections";
import { ApiRequestError } from "@/lib/api-client/request";
import type { CollectionPage } from "@/lib/types/collections";

import { CollectionNameDialog } from "./collection-name-dialog";
import { COLLECTIONS_KEY } from "./collection-picker";
import { SAVES_KEY } from "./saved-view";

// Collection page (`/saved/{id}`, COLL-03…07, USER_FLOWS F-09; built from the system). The owner
// can rename, switch Private/Public, delete (posts stay in All saved) and remove posts (with
// Undo). Other signed-in users see a public collection read-only, with its owner's name.

const MENU_ITEM =
  "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-sm px-3 text-control text-foreground outline-none data-highlighted:bg-muted";

function failed(error: unknown, fallback: string) {
  showToast({ message: error instanceof ApiRequestError ? error.message : fallback });
}

export function CollectionView({ initialPage }: { initialPage: CollectionPage }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [collection, setCollection] = useState(initialPage.collection);
  const [removed, setRemoved] = useState<Set<string>>(() => new Set());
  const [isRenaming, setIsRenaming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { id, isOwner } = collection;

  const items = useInfiniteQuery({
    queryKey: ["collection", id],
    queryFn: ({ pageParam }) => getCollectionPage(id, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    initialData: { pages: [initialPage], pageParams: [null] },
  });
  const posts = items.data.pages
    .flatMap((page) => page.items)
    .filter((post) => !removed.has(post.id));

  function refreshLists() {
    void queryClient.invalidateQueries({ queryKey: COLLECTIONS_KEY });
    void queryClient.invalidateQueries({ queryKey: SAVES_KEY });
  }

  async function changeVisibility() {
    const visibility = collection.visibility === "PUBLIC" ? "PRIVATE" : "PUBLIC";
    try {
      const updated = await updateCollection(id, { visibility });
      setCollection((current) => ({ ...current, ...updated }));
      refreshLists();
      showToast({
        message: visibility === "PUBLIC" ? "Collection is public" : "Collection is private",
      });
    } catch (error) {
      failed(error, "We couldn't change that. Try again.");
    }
  }

  async function remove(postId: string, title: string) {
    setRemoved((current) => new Set(current).add(postId));
    try {
      await removeFromCollection(id, postId);
      setCollection((current) => ({ ...current, itemCount: Math.max(0, current.itemCount - 1) }));
      refreshLists();
      showToast({
        message: `Removed from ${collection.name}`,
        action: { label: "Undo", onAction: () => void undoRemove(postId) },
      });
    } catch (error) {
      setRemoved((current) => withoutId(current, postId));
      failed(error, `We couldn't remove ${title}. Try again.`);
    }
  }

  async function undoRemove(postId: string) {
    try {
      await addToCollection(id, postId);
      setRemoved((current) => withoutId(current, postId));
      setCollection((current) => ({ ...current, itemCount: current.itemCount + 1 }));
      refreshLists();
    } catch (error) {
      failed(error, "We couldn't undo that. Try again.");
    }
  }

  async function confirmDelete() {
    try {
      await deleteCollection(id);
      refreshLists();
      showToast({ message: `Deleted ${collection.name}. Its posts are still in All saved.` });
      router.push("/saved");
    } catch (error) {
      failed(error, "We couldn't delete that collection. Try again.");
    }
  }

  const isPublic = collection.visibility === "PUBLIC";

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        {isOwner ? (
          <Link
            href="/saved"
            className="inline-flex items-center gap-1.5 self-start rounded-sm text-control font-bold text-foreground-secondary hover:text-foreground"
          >
            <ArrowLeft aria-hidden className="size-4" />
            Saved
          </Link>
        ) : null}
        <h1 className="text-greeting text-balance break-words text-foreground md:text-greeting-web">
          {collection.name}
        </h1>
        <p className="flex flex-wrap items-center gap-1.5 text-body text-foreground-secondary">
          {isPublic ? (
            <Globe aria-hidden className="size-4" />
          ) : (
            <Lock aria-hidden className="size-4" />
          )}
          {collection.itemCount} saved · {isPublic ? "Public" : "Private"}
          {collection.owner ? <span>· by {collection.owner.displayName}</span> : null}
        </p>
        {isOwner ? (
          <div className="mt-2 flex flex-wrap gap-2.5">
            <Button variant="outline" size="sm" onClick={() => setIsRenaming(true)}>
              <Pencil aria-hidden className="size-4" />
              Rename
            </Button>
            <Button variant="outline" size="sm" onClick={() => void changeVisibility()}>
              {isPublic ? (
                <Lock aria-hidden className="size-4" />
              ) : (
                <Globe aria-hidden className="size-4" />
              )}
              {isPublic ? "Make private" : "Make public"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsDeleting(true)}>
              <Trash2 aria-hidden className="size-4" />
              Delete
            </Button>
          </div>
        ) : null}
      </header>

      {posts.length === 0 && !items.hasNextPage ? (
        <EmptyState
          title="No posts here yet"
          titleAs="h2"
          description={
            isOwner
              ? "Use “Save to collection” on any post to add it here."
              : "Nothing has been added to this collection yet."
          }
          action={
            isOwner ? (
              <Button asChild>
                <Link href="/feed">Go to your feed</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Masonry
          items={posts}
          getKey={(post) => post.id}
          getHeight={(post) => cardHeight(post.coverMedia.width, post.coverMedia.height)}
          renderItem={(post) => (
            <PostCard
              post={post}
              isSignedIn
              menu={
                isOwner ? (
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger
                      aria-label={`More options for ${post.title}`}
                      className="flex size-9 items-center justify-center rounded-full text-foreground-secondary hover:bg-muted"
                    >
                      <MoreHorizontal aria-hidden className="size-5" />
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.Content
                        align="end"
                        sideOffset={4}
                        className="z-50 min-w-52 rounded-md border border-border bg-background p-1 shadow-float"
                      >
                        <DropdownMenu.Item
                          className={MENU_ITEM}
                          onSelect={() => void remove(post.id, post.title)}
                        >
                          <FolderMinus aria-hidden className="size-4.5" />
                          Remove from collection
                        </DropdownMenu.Item>
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>
                ) : undefined
              }
            />
          )}
        />
      )}
      {items.isFetchingNextPage ? <MasonrySkeleton label="Loading more posts" /> : null}
      {items.isFetchNextPageError ? (
        <ErrorState
          message="We couldn't load more posts."
          onRetry={() => void items.fetchNextPage({ cancelRefetch: false })}
        />
      ) : items.hasNextPage && !items.isFetchingNextPage ? (
        <Button
          variant="outline"
          className="self-center"
          onClick={() => void items.fetchNextPage({ cancelRefetch: false })}
        >
          Load more
        </Button>
      ) : null}

      {isOwner ? (
        <>
          <CollectionNameDialog
            open={isRenaming}
            onOpenChange={setIsRenaming}
            title="Rename collection"
            submitLabel="Save name"
            initialName={collection.name}
            onSubmit={async (name) => {
              const updated = await updateCollection(id, { name });
              setCollection((current) => ({ ...current, ...updated }));
              refreshLists();
            }}
          />
          <Dialog open={isDeleting} onOpenChange={setIsDeleting}>
            <DialogContent>
              <DialogTitle>Delete “{collection.name}”?</DialogTitle>
              <DialogDescription>Saved posts will stay in All saved.</DialogDescription>
              <div className="flex flex-wrap gap-2.5">
                <Button onClick={() => void confirmDelete()}>Delete collection</Button>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
              </div>
            </DialogContent>
          </Dialog>
        </>
      ) : null}
    </div>
  );
}

function withoutId(ids: Set<string>, id: string): Set<string> {
  const next = new Set(ids);
  next.delete(id);
  return next;
}
