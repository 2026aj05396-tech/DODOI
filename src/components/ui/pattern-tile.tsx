import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils/cn";

// Craft-patterned colour tiles (UI_UX_GUIDELINES §2.3): media placeholders and failed-image
// fallbacks, skill swatches, theme cards, default avatars. Decorative by default.

export const PATTERN_ACCENTS = ["butter", "blush", "lavender", "mint", "sky", "coral"] as const;
export type PatternAccent = (typeof PATTERN_ACCENTS)[number] | "new-to-you";

const PATTERN_CLASSES: Record<PatternAccent, string> = {
  butter: "bg-pattern-butter",
  blush: "bg-pattern-blush",
  lavender: "bg-pattern-lavender",
  mint: "bg-pattern-mint",
  sky: "bg-pattern-sky",
  coral: "bg-pattern-coral",
  "new-to-you": "bg-pattern-new-to-you animate-dd-stripe",
};

export type PatternTileProps = ComponentPropsWithoutRef<"div"> & {
  accent: PatternAccent;
};

export function PatternTile({ accent, className, children, ...props }: PatternTileProps) {
  return (
    <div
      aria-hidden={children ? undefined : true}
      className={cn(PATTERN_CLASSES[accent], "rounded-card", className)}
      {...props}
    >
      {children}
    </div>
  );
}
