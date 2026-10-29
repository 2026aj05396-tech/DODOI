"use client";

import { Heart } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { showToast } from "@/components/ui/toast";
import { likePost, unlikePost } from "@/lib/api-client/likes";
import { ApiRequestError } from "@/lib/api-client/request";
import { cn } from "@/lib/utils/cn";

// Heart on the post page (P2-05, LIKE-01, F-20 step 1): filled at once and put back with a toast if
// the request fails. Signed-out visitors go to sign-in and come back (OD-29). The person who
// wrote the post also sees "{n} likes" (LIKE-02); nobody else ever sees a count.

export function LikeButton({
  postId,
  initialLiked,
  isSignedIn,
  className,
}: {
  postId: string;
  initialLiked: boolean;
  isSignedIn: boolean;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isLiked, setIsLiked] = useState(initialLiked);
  const [isBusy, setIsBusy] = useState(false);

  async function toggle() {
    if (!isSignedIn) {
      router.push(`/sign-in?returnTo=${encodeURIComponent(pathname)}`);
      return;
    }
    const next = !isLiked;
    setIsLiked(next);
    setIsBusy(true);
    try {
      await (next ? likePost(postId) : unlikePost(postId));
    } catch (error) {
      setIsLiked(!next);
      showToast({
        message: error instanceof ApiRequestError ? error.message : "We couldn't update your like.",
      });
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <button
      type="button"
      aria-pressed={isLiked}
      aria-label={isLiked ? "Unlike" : "Like"}
      disabled={isBusy}
      onClick={() => void toggle()}
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-full border-control border-input bg-background text-foreground transition duration-150 hover:bg-muted active:scale-96",
        className,
      )}
    >
      <Heart aria-hidden className={cn("size-5", isLiked && "fill-primary text-primary")} />
    </button>
  );
}
