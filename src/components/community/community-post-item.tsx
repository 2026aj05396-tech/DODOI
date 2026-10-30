"use client";

import { Ban, EyeOff, Eye, Flag, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { useId, useState } from "react";

import { ConfirmDeleteDialog } from "@/components/companion/confirm-delete-dialog";
import { Avatar } from "@/components/profile/avatar";
import { ReportDialog } from "@/components/reports/report-button";
import { BlockDialog } from "@/components/safety/block-dialog";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Label, Textarea } from "@/components/ui/input";
import { showToast } from "@/components/ui/toast";
import {
  deleteCommunityPost,
  moderateCommunity,
  updateCommunityPost,
} from "@/lib/api-client/communities";
import { ApiRequestError } from "@/lib/api-client/request";
import { COMMUNITY_POST_MAX } from "@/lib/schemas/communities";
import type { CommunityPostView } from "@/lib/types/communities";
import { cn } from "@/lib/utils/cn";
import { timeAgo } from "@/lib/utils/time-ago";

// One discussion post or reply (COM-05, COM-06, COM-07): the author and time, the text, photos, and
// a ⋯ menu with what the viewer may do: edit (author, 15 minutes), delete (author, owner,
// moderators), hide or restore (owner, moderators), report and block (someone else's post).

const MENU_ITEM =
  "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-sm px-3 text-control text-foreground outline-none data-highlighted:bg-muted";

export function CommunityPostItem({
  slug,
  post,
  isReply,
  isManager,
  onChange,
  onDeleted,
  children,
}: {
  slug: string;
  post: CommunityPostView;
  isReply: boolean;
  isManager: boolean;
  onChange: (post: CommunityPostView) => void;
  onDeleted: (id: string) => void;
  /** The reply button and the replies of a post. */
  children?: React.ReactNode;
}) {
  const id = useId();
  const [dialog, setDialog] = useState<"report" | "block" | "delete" | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(post.body);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const noun = isReply ? "reply" : "post";

  function messageOf(caught: unknown, fallback: string): string {
    return caught instanceof ApiRequestError ? caught.message : fallback;
  }

  async function saveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return;
    setIsBusy(true);
    setError(null);
    try {
      onChange(await updateCommunityPost(post.id, draft.trim()));
      setIsEditing(false);
    } catch (caught) {
      setError(messageOf(caught, "We couldn't save that. Try again."));
    } finally {
      setIsBusy(false);
    }
  }

  async function toggleHidden() {
    const hide = !post.isHidden;
    try {
      await moderateCommunity(slug, {
        action: hide ? "HIDE_POST" : "RESTORE_POST",
        targetId: post.id,
      });
      onChange({ ...post, isHidden: hide });
      showToast({ message: hide ? `The ${noun} is hidden` : `The ${noun} is back` });
    } catch (caught) {
      showToast({ message: messageOf(caught, "We couldn't change that.") });
    }
  }

  async function remove() {
    setIsBusy(true);
    try {
      await deleteCommunityPost(post.id);
      showToast({ message: isReply ? "Reply deleted" : "Post deleted" });
      onDeleted(post.id);
    } catch (caught) {
      setIsBusy(false);
      setDialog(null);
      showToast({ message: messageOf(caught, "We couldn't delete that.") });
    }
  }

  const hasMenu = post.canEdit || post.canDelete || isManager || !post.isOwn;

  return (
    <article
      id={`post-${post.id}`}
      className={cn(
        "flex flex-col gap-2.5",
        !isReply && "rounded-card border border-border bg-background p-4",
        post.isHidden && "opacity-70",
      )}
    >
      <div className="flex items-center gap-2.5">
        <Avatar url={post.author?.avatarUrl ?? null} className="size-8 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-control font-bold text-foreground">
            {post.isOwn ? "You" : (post.author?.displayName ?? "A maker")}
          </p>
          <p className="text-meta text-foreground-secondary">
            {timeAgo(post.createdAt)}
            {post.isEdited ? " · edited" : ""}
          </p>
        </div>
        {hasMenu ? (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger
              aria-label={`More options for this ${noun}`}
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
                {post.canEdit ? (
                  <DropdownMenu.Item
                    className={MENU_ITEM}
                    onSelect={() => {
                      setDraft(post.body);
                      setIsEditing(true);
                    }}
                  >
                    <Pencil aria-hidden className="size-4.5" />
                    Edit {noun}
                  </DropdownMenu.Item>
                ) : null}
                {isManager ? (
                  <DropdownMenu.Item className={MENU_ITEM} onSelect={() => void toggleHidden()}>
                    {post.isHidden ? (
                      <Eye aria-hidden className="size-4.5" />
                    ) : (
                      <EyeOff aria-hidden className="size-4.5" />
                    )}
                    {post.isHidden ? `Restore ${noun}` : `Hide ${noun}`}
                  </DropdownMenu.Item>
                ) : null}
                {post.canDelete ? (
                  <DropdownMenu.Item className={MENU_ITEM} onSelect={() => setDialog("delete")}>
                    <Trash2 aria-hidden className="size-4.5" />
                    Delete {noun}
                  </DropdownMenu.Item>
                ) : null}
                {!post.isOwn ? (
                  <DropdownMenu.Item className={MENU_ITEM} onSelect={() => setDialog("report")}>
                    <Flag aria-hidden className="size-4.5" />
                    Report {noun}
                  </DropdownMenu.Item>
                ) : null}
                {!post.isOwn && post.author ? (
                  <DropdownMenu.Item className={MENU_ITEM} onSelect={() => setDialog("block")}>
                    <Ban aria-hidden className="size-4.5" />
                    Block @{post.author.username}
                  </DropdownMenu.Item>
                ) : null}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        ) : null}
      </div>

      {post.isHidden ? (
        <p
          role="status"
          className="rounded-md bg-destructive-surface p-2.5 text-meta text-foreground"
        >
          <span className="font-bold">Hidden.</span>{" "}
          {post.isOwn
            ? `A moderator hid your ${noun}. Only you and the moderators can see it.`
            : `Only moderators can see this ${noun}.`}
        </p>
      ) : null}

      {isEditing ? (
        <form method="post" onSubmit={saveEdit} className="flex flex-col gap-2">
          <Label htmlFor={`${id}-edit`}>Edit your {noun}</Label>
          <Textarea
            id={`${id}-edit`}
            value={draft}
            rows={4}
            maxLength={COMMUNITY_POST_MAX}
            onChange={(event) => setDraft(event.target.value)}
          />
          <FieldError id={`${id}-edit-error`}>{error}</FieldError>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isBusy || draft.trim() === ""}>
              {isBusy ? "Saving…" : "Save"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isBusy}
              onClick={() => {
                setIsEditing(false);
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-body wrap-break-word whitespace-pre-line text-foreground">{post.body}</p>
      )}

      {post.photos.length > 0 ? (
        <ul className="flex flex-wrap gap-2.5">
          {post.photos.map((photo, index) => (
            <li key={photo.id}>
              {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary serves the sizes in srcSet. */}
              <img
                src={photo.url}
                srcSet={photo.srcSet}
                sizes="(min-width: 768px) 240px, 45vw"
                alt={photo.altText ?? `Photo ${index + 1} in this ${noun}`}
                width={photo.width}
                height={photo.height}
                className="max-h-60 w-auto max-w-full rounded-md object-cover"
              />
            </li>
          ))}
        </ul>
      ) : null}

      {children}

      {dialog === "report" ? (
        <ReportDialog
          targetType="COMMUNITY_POST"
          targetId={post.id}
          targetLabel={`this ${noun}`}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog === "block" && post.author ? (
        <BlockDialog username={post.author.username} onClose={() => setDialog(null)} />
      ) : null}
      {dialog === "delete" ? (
        <ConfirmDeleteDialog
          title={`Delete this ${noun}?`}
          description={
            isReply
              ? "This can't be undone."
              : "Its replies and photos go with it. This can't be undone."
          }
          confirmLabel={`Delete ${noun}`}
          isBusy={isBusy}
          onConfirm={() => void remove()}
          onCancel={() => setDialog(null)}
        />
      ) : null}
    </article>
  );
}
