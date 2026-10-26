"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils/cn";

/**
 * Round "Back" button over the post media (`1e`). Goes back in history when there is a page to go
 * back to; a shared link opened in a new tab goes to `fallbackHref` instead.
 */
export function BackButton({
  fallbackHref,
  className,
}: {
  fallbackHref: string;
  className?: string;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label="Back"
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push(fallbackHref);
      }}
      className={cn(
        "flex size-11 items-center justify-center rounded-full bg-background text-foreground shadow-float",
        className,
      )}
    >
      <ArrowLeft aria-hidden className="size-5" strokeWidth={2} />
    </button>
  );
}
