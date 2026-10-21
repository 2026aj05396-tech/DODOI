import { Sparkles } from "lucide-react";

import { ComingSoonBadge } from "@/components/ui/coming-soon";
import { cn } from "@/lib/utils/cn";

import { ComingSoonTrigger } from "./coming-soon-trigger";

// Entry points for the AI companion (Phase 4). Shown as coming soon until then.

/** Floating pill above the tab bar (mobile `1c`) or bottom-right (tablet `3c`). */
export function AskDodoiPill({ className }: { className?: string }) {
  return (
    <ComingSoonTrigger
      label="Ask dodoi"
      hasVisibleLabel
      className={cn(
        "fixed z-30 flex h-11 items-center gap-2 rounded-full bg-inverse pr-3 pl-3 text-control font-bold text-inverse-foreground/70 shadow-float",
        className,
      )}
    >
      <Sparkles aria-hidden className="size-4.5 text-butter" />
      Ask dodoi
      <ComingSoonBadge size="sm" decorative />
    </ComingSoonTrigger>
  );
}

/** Gingham card at the bottom of the desktop sidebar (`2b`). */
export function AskDodoiCard() {
  return (
    <ComingSoonTrigger
      label="Ask dodoi"
      hasVisibleLabel
      className="flex w-full flex-col gap-2 rounded-lg p-4 text-left bg-pattern-lavender"
    >
      <span className="flex items-center gap-1.5 text-control-lg font-bold text-foreground">
        <Sparkles aria-hidden className="size-4 text-plum" />
        Ask dodoi
        <ComingSoonBadge size="sm" decorative className="ml-auto" />
      </span>
      <span className="text-control-sm text-foreground-secondary">
        Stuck on a stitch? Show me a photo.
      </span>
    </ComingSoonTrigger>
  );
}
