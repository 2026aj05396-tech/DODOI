"use client";

import { Ban, Flag, MoreHorizontal } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { useState } from "react";

import { ReportDialog } from "@/components/reports/report-button";

import { BlockDialog } from "./block-dialog";

// ⋯ menu on someone else's post (F-22 step 1): Report, and Block the maker when there is one.

const MENU_ITEM =
  "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-sm px-3 text-control text-foreground outline-none data-highlighted:bg-muted";

export function PostMenu({
  postId,
  creator,
}: {
  postId: string;
  /** The maker, if the post has one (team and stock posts have none). */
  creator: { username: string; displayName: string } | null;
}) {
  const [dialog, setDialog] = useState<"report" | "block" | null>(null);
  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          aria-label="More options for this post"
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-muted"
        >
          <MoreHorizontal aria-hidden className="size-5" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={4}
            className="z-50 min-w-52 rounded-md border border-border bg-background p-1 shadow-float"
          >
            <DropdownMenu.Item className={MENU_ITEM} onSelect={() => setDialog("report")}>
              <Flag aria-hidden className="size-4.5" />
              Report post
            </DropdownMenu.Item>
            {creator ? (
              <DropdownMenu.Item className={MENU_ITEM} onSelect={() => setDialog("block")}>
                <Ban aria-hidden className="size-4.5" />
                Block @{creator.username}
              </DropdownMenu.Item>
            ) : null}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      {dialog === "report" ? (
        <ReportDialog
          targetType="POST"
          targetId={postId}
          targetLabel="this post"
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog === "block" && creator ? (
        <BlockDialog username={creator.username} onClose={() => setDialog(null)} />
      ) : null}
    </>
  );
}
