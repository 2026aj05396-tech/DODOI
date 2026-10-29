"use client";

import { Share2 } from "lucide-react";

import { showToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils/cn";

/** Shares a post with the system share sheet, or copies its link where there is none. */
export async function sharePost(title: string, path: string): Promise<void> {
  const url = new URL(path, window.location.origin).toString();
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title, url });
      return;
    } catch (error) {
      // Closing the share sheet is not an error; anything else falls back to copying.
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    showToast({ message: "Link copied" });
  } catch {
    showToast({ message: "We couldn't copy the link. Copy it from the address bar instead." });
  }
}

/**
 * Share a post (POST-09): the device's share sheet where the Web Share API exists, otherwise the
 * link is copied with a toast. `overlay` is the round button over the mobile media (`1e`);
 * `outline` sits next to the other actions on tablet and desktop.
 */
export function ShareButton({
  title,
  path,
  variant,
  className,
}: {
  title: string;
  /** Path of the post, e.g. "/p/abc"; shared as an absolute link. */
  path: string;
  variant: "overlay" | "outline";
  className?: string;
}) {
  const share = () => sharePost(title, path);

  return (
    <button
      type="button"
      aria-label="Share"
      onClick={share}
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-full text-foreground",
        variant === "overlay"
          ? "bg-background shadow-float"
          : "border-control border-foreground transition-transform active:scale-96",
        className,
      )}
    >
      <Share2 aria-hidden className="size-5" strokeWidth={1.9} />
    </button>
  );
}
