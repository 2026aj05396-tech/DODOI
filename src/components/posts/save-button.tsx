"use client";

import { useMutation } from "@tanstack/react-query";
import { Bookmark } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { showToast } from "@/components/ui/toast";
import { ApiRequestError } from "@/lib/api-client/request";
import { savePost, unsavePost } from "@/lib/api-client/saves";
import { cn } from "@/lib/utils/cn";

// Save / unsave from a card (FEED-04, COLL-01; `1c`/`2b`): paper circle with a bookmark; saved =
// coral fill with a pop. Optimistic (UI_UX_GUIDELINES §6): shows at once, goes back with a toast
// if saving fails. Signed-out visitors go to sign-in and come back here (OD-29).

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
  const [isSaved, setIsSaved] = useState(initialSaved);

  const mutation = useMutation({
    mutationFn: async (save: boolean): Promise<void> => {
      if (save) await savePost(postId);
      else await unsavePost(postId);
    },
    onError: (error, save) => {
      setIsSaved(!save);
      showToast({
        message:
          error instanceof ApiRequestError
            ? error.message
            : "We couldn't update your saves. Try again.",
      });
    },
  });

  function toggle() {
    if (!isSignedIn) {
      router.push(`/sign-in?returnTo=${encodeURIComponent(pathname)}`);
      return;
    }
    const next = !isSaved;
    setIsSaved(next);
    mutation.mutate(next);
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
