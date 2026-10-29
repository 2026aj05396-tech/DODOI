"use client";

import Link from "next/link";
import { useEffect, useRef, type CSSProperties } from "react";

import { ShareButton } from "@/components/posts/share-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

// The one celebration of the flow (UI_UX_GUIDELINES §8.1): a short burst of craft-coloured
// confetti and "Posted!" when a post is shared. Reduced motion shows the card without confetti.

const COLOURS = ["bg-butter", "bg-coral", "bg-lavender", "bg-mint", "bg-sky", "bg-blush"];
const PIECES = 36;

/** Same scatter on every render (no randomness during rendering). */
function piece(index: number) {
  const spread = (index * 37) % 100;
  return {
    colour: COLOURS[index % COLOURS.length],
    shape: index % 3 === 0 ? "size-2.5 rounded-full" : "h-3.5 w-2 rounded-xs",
    style: {
      left: `${spread}%`,
      animationDelay: `${(index * 53) % 450}ms`,
      "--confetti-drift": `${((index * 29) % 120) - 60}px`,
      "--confetti-spin": `${360 + ((index * 71) % 540)}deg`,
    } as CSSProperties,
  };
}

export function Celebration({ postId, title }: { postId: string; title: string }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="posted-heading"
      className="fixed inset-0 z-50 flex items-center justify-center bg-inverse/40 p-5"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden motion-reduce:hidden"
      >
        {Array.from({ length: PIECES }, (_, index) => {
          const { colour, shape, style } = piece(index);
          return (
            <span
              key={index}
              className={cn("absolute top-0 animate-dd-confetti", colour, shape)}
              style={style}
            />
          );
        })}
      </div>
      <div className="relative flex w-full max-w-sm animate-dd-pop flex-col items-center gap-4 rounded-xl bg-popover p-7 text-center shadow-frame">
        <span aria-hidden className="text-hero">
          🎉
        </span>
        <h2
          id="posted-heading"
          ref={heading}
          tabIndex={-1}
          className="text-title text-foreground outline-none"
        >
          Posted!
        </h2>
        <p className="text-body text-foreground-secondary">
          “{title}” is in the feed now. Send the link to a friend who&apos;d love it?
        </p>
        <div className="flex w-full flex-col gap-2.5">
          <ShareButton title={title} path={`/p/${postId}`} variant="wide" />
          <Button asChild size="lg">
            <Link href={`/p/${postId}`}>See your post</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
