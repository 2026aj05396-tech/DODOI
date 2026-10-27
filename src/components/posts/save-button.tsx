"use client";

import { Bookmark } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { openCollectionPicker } from "@/components/collections/collection-picker";
import { setSaved, useIsSaved } from "@/components/collections/saved-store";
import { recordSave } from "@/components/pwa/install-store";
import { showToast } from "@/components/ui/toast";
import { useIsOnline } from "@/hooks/use-is-online";
import { addToCollection, getCollectionIdsForPost } from "@/lib/api-client/collections";
import { ApiRequestError } from "@/lib/api-client/request";
import { savePost, unsavePost } from "@/lib/api-client/saves";
import { cn } from "@/lib/utils/cn";

// Save / unsave from a card (FEED-04, COLL-01, USER_FLOWS F-09; `1c`/`2b`): paper circle with a
// bookmark; saved = coral fill with a pop. Optimistic: shows at once and goes back with a toast if
// the request fails. After saving, the toast offers "Add to collection"; after unsaving (which
// also empties it from every collection) it offers Undo, which restores both (PO decision, P1-25).
// Signed-out visitors go to sign-in and come back here (OD-29). Offline, nothing is queued
// (offline matrix): the button looks disabled, says why on hover, and explains in a toast if tapped.

const OFFLINE_HINT = "Saving needs a connection";

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
  const isOnline = useIsOnline();
  const isUnavailable = isSignedIn && !isOnline;

  async function save() {
    setSaved(postId, true);
    try {
      await savePost(postId);
      // The first save is enough engagement to offer installing the app (USER_FLOWS F-12).
      recordSave();
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
    if (isUnavailable) {
      showToast({ message: `You're offline. ${OFFLINE_HINT}.` });
      return;
    }
    void (isSaved ? unsave() : save());
  }

  return (
    <button
      type="button"
      aria-pressed={isSaved}
      aria-label={`Save ${postTitle}`}
      // Stays focusable while offline, so keyboard and screen reader users can hear why.
      aria-disabled={isUnavailable || undefined}
      title={isUnavailable ? OFFLINE_HINT : undefined}
      onClick={toggle}
      className={cn(
        "flex size-9 items-center justify-center rounded-full bg-background text-foreground transition-transform active:scale-96 aria-disabled:opacity-60 aria-disabled:active:scale-100",
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
