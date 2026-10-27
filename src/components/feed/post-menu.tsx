"use client";

import { EyeOff, MoreHorizontal, Sparkles } from "lucide-react";
import Link from "next/link";
import { DropdownMenu } from "radix-ui";

// The "⋯" menu on a feed card (USER_FLOWS F-06): "Not interested" (FEED-05) and "More like this"
// (FEED-06, the post's related posts).

const ITEM =
  "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-sm px-3 text-control text-foreground outline-none data-highlighted:bg-muted";

export function PostMenu({
  postId,
  postTitle,
  onNotInterested,
}: {
  postId: string;
  postTitle: string;
  onNotInterested: () => void;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={`More options for ${postTitle}`}
        className="flex size-9 items-center justify-center rounded-full text-foreground-secondary hover:bg-muted"
      >
        <MoreHorizontal aria-hidden className="size-5" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="z-50 min-w-48 rounded-md border border-border bg-background p-1 shadow-float"
        >
          <DropdownMenu.Item className={ITEM} onSelect={onNotInterested}>
            <EyeOff aria-hidden className="size-4.5" />
            Not interested
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild className={ITEM}>
            <Link href={`/p/${postId}#related-posts`}>
              <Sparkles aria-hidden className="size-4.5" />
              More like this
            </Link>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
