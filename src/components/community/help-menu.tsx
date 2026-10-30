"use client";

import { Ban, Flag, MoreHorizontal } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { useState } from "react";

import { ReportDialog } from "@/components/reports/report-button";
import { BlockDialog } from "@/components/safety/block-dialog";

// ⋯ menu on someone else's help request or response (F-27 step 4): Report, and Block the person.

const MENU_ITEM =
  "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-sm px-3 text-control text-foreground outline-none data-highlighted:bg-muted";

export function HelpMenu({
  target,
  label,
  author,
}: {
  target: { type: "HELP_REQUEST" | "HELP_RESPONSE"; id: string };
  /** "request" or "response", for the accessible name and the report title. */
  label: "request" | "response";
  author: { username: string; displayName: string } | null;
}) {
  const [dialog, setDialog] = useState<"report" | "block" | null>(null);
  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          aria-label={`More options for this ${label}`}
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
              Report {label}
            </DropdownMenu.Item>
            {author ? (
              <DropdownMenu.Item className={MENU_ITEM} onSelect={() => setDialog("block")}>
                <Ban aria-hidden className="size-4.5" />
                Block @{author.username}
              </DropdownMenu.Item>
            ) : null}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      {dialog === "report" ? (
        <ReportDialog
          targetType={target.type}
          targetId={target.id}
          targetLabel={`this ${label}`}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog === "block" && author ? (
        <BlockDialog username={author.username} onClose={() => setDialog(null)} />
      ) : null}
    </>
  );
}
