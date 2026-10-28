"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils/cn";

/**
 * Icon-only "Back": goes back in history when there is a page to go back to; a shared link opened
 * in a new tab follows `fallbackHref` instead. It is a real link, so the unsaved-changes warning
 * (`useUnsavedChanges`) still catches it and a middle click opens the parent page.
 * `overlay` is the round button over post media (`1e`); `plain` sits above a page title.
 */
export function BackButton({
  fallbackHref,
  appearance = "plain",
  className,
}: {
  fallbackHref: string;
  appearance?: "plain" | "overlay";
  className?: string;
}) {
  const router = useRouter();
  return (
    <Link
      href={fallbackHref}
      aria-label="Back"
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        if (window.history.length > 1) {
          event.preventDefault();
          router.back();
        }
      }}
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-full text-foreground",
        appearance === "overlay" ? "bg-background shadow-float" : "-ml-3 self-start hover:bg-muted",
        className,
      )}
    >
      <ArrowLeft aria-hidden className="size-5" strokeWidth={2} />
    </Link>
  );
}
