"use client";

import { Ban, Flag, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { DropdownMenu } from "radix-ui";
import { useState } from "react";

import { ReportDialog } from "@/components/reports/report-button";
import { BlockDialog } from "@/components/safety/block-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Comment } from "@/lib/types/comments";
import { relativeDay } from "@/lib/utils/relative-day";

import { CommentComposer } from "./comment-composer";

// One comment or reply (F-19, CMT-01…03). Own comments have Edit and Delete in a ⋯ menu; the
// post's author can delete others'; everyone else's comments offer Report and Block (P2-08).

const MENU_ITEM =
  "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-sm px-3 text-control text-foreground outline-none data-highlighted:bg-muted";

function Avatar({ comment }: { comment: Comment }) {
  const { author } = comment;
  if (author?.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Cloudinary sizes the image.
      <img
        src={author.avatarUrl}
        alt=""
        width={32}
        height={32}
        className="size-8 shrink-0 rounded-full bg-muted object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden
      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-butter text-control-sm font-bold text-foreground"
    >
      {(author?.displayName ?? "?").slice(0, 1).toUpperCase()}
    </span>
  );
}

export function CommentItem({
  comment,
  canReply,
  onReply,
  onEdit,
  onDelete,
}: {
  comment: Comment;
  canReply: boolean;
  /** Opens the reply field under the thread; `mention` starts it with @username. */
  onReply: (comment: Comment) => void;
  onEdit: (comment: Comment, body: string) => Promise<void>;
  onDelete: (comment: Comment) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [dialog, setDialog] = useState<"report" | "block" | null>(null);

  if (comment.isDeleted) {
    return (
      <p id={`comment-${comment.id}`} className="py-1 text-body text-muted-foreground italic">
        Comment deleted
      </p>
    );
  }

  const name = comment.author?.displayName ?? "A dodoi member";

  async function confirmDelete() {
    setIsDeleting(true);
    try {
      await onDelete(comment);
    } finally {
      setIsDeleting(false);
      setIsConfirmingDelete(false);
    }
  }

  return (
    <div id={`comment-${comment.id}`} className="flex gap-3">
      <Avatar comment={comment} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="min-w-0 truncate text-body font-bold text-foreground">
            {comment.author ? (
              <Link href={`/u/${comment.author.username}`} className="hover:underline">
                {name}
              </Link>
            ) : (
              name
            )}
          </p>
          <p className="shrink-0 text-meta text-muted-foreground">
            {relativeDay(comment.createdAt)}
            {comment.editedAt ? " · edited" : ""}
          </p>
          {canReply || comment.isOwn || comment.canDelete ? (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger
                aria-label={`Options for ${name}'s comment`}
                className="-my-2 ml-auto flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
              >
                <MoreHorizontal aria-hidden className="size-5" />
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={4}
                  className="z-50 min-w-44 rounded-md border border-border bg-background p-1 shadow-float"
                >
                  {comment.isOwn ? (
                    <DropdownMenu.Item className={MENU_ITEM} onSelect={() => setIsEditing(true)}>
                      <Pencil aria-hidden className="size-4.5" />
                      Edit
                    </DropdownMenu.Item>
                  ) : null}
                  {comment.isOwn || comment.canDelete ? (
                    <DropdownMenu.Item
                      className={MENU_ITEM}
                      onSelect={() => setIsConfirmingDelete(true)}
                    >
                      <Trash2 aria-hidden className="size-4.5" />
                      Delete
                    </DropdownMenu.Item>
                  ) : null}
                  {comment.isOwn ? null : (
                    <DropdownMenu.Item className={MENU_ITEM} onSelect={() => setDialog("report")}>
                      <Flag aria-hidden className="size-4.5" />
                      Report
                    </DropdownMenu.Item>
                  )}
                  {comment.isOwn || !comment.author ? null : (
                    <DropdownMenu.Item className={MENU_ITEM} onSelect={() => setDialog("block")}>
                      <Ban aria-hidden className="size-4.5" />
                      Block @{comment.author.username}
                    </DropdownMenu.Item>
                  )}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          ) : null}
        </div>

        {isEditing ? (
          <div className="mt-1.5">
            <CommentComposer
              label={`Edit comment ${comment.id}`}
              submitLabel="Save"
              initialValue={comment.body ?? ""}
              autoFocus
              onSubmit={async (body) => {
                await onEdit(comment, body);
                setIsEditing(false);
              }}
              onCancel={() => setIsEditing(false)}
            />
          </div>
        ) : (
          <>
            {comment.isHidden ? (
              <p className="mt-0.5 text-meta font-bold text-destructive">Hidden after a report</p>
            ) : null}
            <p className="mt-0.5 text-body break-words whitespace-pre-line text-foreground">
              {comment.body}
            </p>
          </>
        )}

        {canReply && !isEditing ? (
          <button
            type="button"
            onClick={() => onReply(comment)}
            className="mt-1 -ml-2 min-h-11 rounded-sm px-2 text-control-sm font-bold text-muted-foreground hover:text-foreground"
          >
            Reply
            <span className="sr-only"> to {name}</span>
          </button>
        ) : null}
      </div>

      {dialog === "report" ? (
        <ReportDialog
          targetType="COMMENT"
          targetId={comment.id}
          targetLabel="this comment"
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog === "block" && comment.author ? (
        <BlockDialog username={comment.author.username} onClose={() => setDialog(null)} />
      ) : null}

      <Dialog open={isConfirmingDelete} onOpenChange={setIsConfirmingDelete}>
        <DialogContent>
          <DialogTitle>Delete this comment?</DialogTitle>
          <DialogDescription>
            {comment.replyCount > 0
              ? "Its replies stay. This can't be undone."
              : "This can't be undone."}
          </DialogDescription>
          <div className="flex justify-end gap-2.5">
            <DialogClose asChild>
              <Button variant="outline">Keep it</Button>
            </DialogClose>
            <Button
              variant="destructive"
              disabled={isDeleting}
              onClick={() => void confirmDelete()}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
