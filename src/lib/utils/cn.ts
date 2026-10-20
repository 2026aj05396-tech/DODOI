import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// tailwind-merge must know dodoi's custom utilities (src/styles/globals.css); otherwise it treats
// e.g. `text-badge` (a size) and `text-foreground` (a colour), or `border-control` (a width) and
// `border-input` (a colour), as conflicts and silently drops one of them.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "border-w": [{ border: ["control"] }],
    },
    theme: {
      text: [
        "hero",
        "hero-web",
        "title",
        "title-web",
        "greeting",
        "greeting-web",
        "section",
        "card-title",
        "card-title-web",
        "body-lg",
        "body-lg-web",
        "body",
        "meta",
        "meta-web",
        "chip",
        "overline",
        "tab",
        "badge",
        "badge-sm",
        "wordmark",
        "control-sm",
        "control",
        "control-lg",
        "control-xl",
      ],
    },
  },
});

/** Joins class names and resolves conflicting Tailwind utilities (later classes win). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
