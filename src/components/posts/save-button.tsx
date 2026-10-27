"use client";

import { Bookmark } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { openCollectionPicker } from "@/components/collections/collection-picker";
import { setSaved, useIsSaved } from "@/components/collections/saved-store";
import { showToast } from "@/components/ui/toast";
import { addToCollection, getCollectionIdsForPost } from "@/lib/api-client/collections";
import { ApiRequestError } from "@/lib/api-client/request";
import { savePost, unsavePost } from "@/lib/api-client/saves";
import { cn } from "@/lib/utils/cn";

// Save / unsave from a card (FEED-04, COLL-01, USER_FLOWS F-09; `1c`/`2b`): paper circle with a
// bookmark; saved = coral fill with a pop. Optimistic: shows at once and goes back with a toast if
// the request fails. After saving, the toast offers "Add to collection"; after unsaving (which
// also empties it from every collection) it offers Undo, which restores both (PO decision, P1-25).
// Signed-out visitors go to sign-in and come back here (OD-29).

function failed(error: unknown): void {
  showToast({
    message:
      error instanceof ApiRequestError
        ? error.message
        : "We couldn't update your saves. Try again.",
  });
}

export function SaveButton({
  postId,
  postTitle,
  initialSaved,
  isSignedIn,
  className,
}: {
  postId: string;
  postTitle: string;
  initialSaved: boolean;
  isSignedIn: boolean;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const isSaved = useIsSaved(postId, initialSaved);

  async function save() {
    setSaved(postId, true);
    try {
      await savePost(postId);
      showToast({
        message: "Saved",
        action: {
          label: "Add to collection",
          onAction: () => openCollectionPicker({ postId, postTitle }),
        },
      });
    } catch (error) {
      setSaved(postId, false);
      failed(error);
    }
  }

  async function unsave() {
    setSaved(postId, false);
    try {
      // Remember the collections first: unsaving takes the post out of all of them.
      const collectionIds = await getCollectionIdsForPost(postId);
      await unsavePost(postId);
      showToast({
        message: "Removed from saved",
        action: { label: "Undo", onAction: () => void restore(collectionIds) },
      });
    } catch (error) {
      setSaved(postId, true);
      failed(error);
    }
  }

  async function restore(collectionIds: string[]) {
    setSaved(postId, true);
    try {
      await savePost(postId);
      for (const id of collectionIds) await addToCollection(id, postId);
    } catch (error) {
      failed(error);
    }
  }

  function toggle() {
    if (!isSignedIn) {
      router.push(`/sign-in?returnTo=${encodeURIComponent(pathname)}`);
      return;
    }
    void (isSaved ? unsave() : save());
  }

  return (
    <button
      type="button"
      aria-pressed={isSaved}
      aria-label={`Save ${postTitle}`}
      onClick={toggle}
      className={cn(
        "flex size-9 items-center justify-center rounded-full bg-background text-foreground transition-transform active:scale-96",
        className,
      )}
    >
      <Bookmark
        aria-hidden
        className={cn("size-4.5", isSaved && "animate-dd-pop text-selected-border")}
        fill={isSaved ? "currentColor" : "none"}
        strokeWidth={1.8}
      />
    </button>
  );
}
