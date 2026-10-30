"use client";

import { Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils/cn";

// Entry points for the AI companion (P4-02, F-23 step 1): both open `/companion`.

/** Floating pill above the tab bar (mobile `1c`) or bottom-right (tablet `3c`). Hidden in the companion itself. */
export function AskDodoiPill({ className }: { className?: string }) {
  return (
    <AskDodoiPillView className={className} isHidden={usePathname().startsWith("/companion")} />
  );
}

/** The pill without reading the address: the static shell shows it until the browser knows the page. */
export function AskDodoiPillView({
  className,
  isHidden = false,
}: {
  className?: string;
  isHidden?: boolean;
}) {
  if (isHidden) return null;
  return (
    <Link
      href="/companion"
      className={cn(
        "fixed z-30 flex h-11 items-center gap-2 rounded-full bg-inverse pr-4 pl-3 text-control font-bold text-inverse-foreground shadow-float",
        className,
      )}
    >
      <Sparkles aria-hidden className="size-4.5 text-butter" />
      Ask dodoi
    </Link>
  );
}

/** Gingham card at the bottom of the desktop sidebar (`2b`). */
export function AskDodoiCard() {
  return (
    <Link
      href="/companion"
      className="flex w-full flex-col gap-2 rounded-lg p-4 bg-pattern-lavender"
    >
      <span className="flex items-center gap-1.5 text-control-lg font-bold text-foreground">
        <Sparkles aria-hidden className="size-4 text-plum" />
        Ask dodoi
      </span>
      <span className="text-control-sm text-foreground-secondary">
        Stuck on a stitch? Ask me about it.
      </span>
    </Link>
  );
}
