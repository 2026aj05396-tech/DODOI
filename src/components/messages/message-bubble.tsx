"use client";

import { Flag, MoreHorizontal, Trash2 } from "lucide-react";
import { DropdownMenu } from "radix-ui";

import type { MessageView } from "@/lib/types/messages";
import { cn } from "@/lib/utils/cn";

// One message (F-29): yours on the right in coral, theirs on the left; a deleted one reads "Message
// deleted". The ⋯ menu offers Delete on your own and Report on theirs. No "seen" marks (MSG-04).

const MENU_ITEM =
  "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-sm px-3 text-control text-foreground outline-none data-highlighted:bg-muted";

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function MessageBubble({
  message,
  onDelete,
  onReport,
}: {
  message: MessageView;
  onDelete: () => void;
  onReport: () => void;
}) {
  const hasMenu = !message.isDeleted;
  return (
    <div
      className={cn(
        "group flex max-w-[85%] items-end gap-1",
        message.isOwn ? "flex-row-reverse self-end" : "self-start",
      )}
    >
      <div
        className={cn("flex min-w-0 flex-col gap-1", message.isOwn ? "items-end" : "items-start")}
      >
        <p
          className={cn(
            "rounded-2xl px-3.5 py-2.5 text-body-lg wrap-break-word whitespace-pre-line",
            message.isDeleted
              ? "border border-border bg-background text-foreground-secondary italic"
              : message.isOwn
                ? "rounded-br-sm bg-primary text-primary-foreground"
                : "rounded-bl-sm bg-muted text-foreground",
          )}
        >
          {message.isDeleted ? "Message deleted" : message.body}
        </p>
        <time dateTime={message.createdAt} className="px-1 text-meta text-foreground-secondary">
          {formatTime(message.createdAt)}
        </time>
      </div>
      {hasMenu ? (
        <DropdownMenu.Root>
          <DropdownMenu.Trigger
            aria-label={
              message.isOwn ? "More options for your message" : "More options for this message"
            }
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-foreground-secondary hover:bg-muted"
          >
            <MoreHorizontal aria-hidden className="size-4.5" />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align={message.isOwn ? "end" : "start"}
              sideOffset={4}
              className="z-50 min-w-48 rounded-md border border-border bg-background p-1 shadow-float"
            >
              {message.isOwn ? (
                <DropdownMenu.Item className={MENU_ITEM} onSelect={onDelete}>
                  <Trash2 aria-hidden className="size-4.5" />
                  Delete message
                </DropdownMenu.Item>
              ) : (
                <DropdownMenu.Item className={MENU_ITEM} onSelect={onReport}>
                  <Flag aria-hidden className="size-4.5" />
                  Report message
                </DropdownMenu.Item>
              )}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      ) : null}
    </div>
  );
}
