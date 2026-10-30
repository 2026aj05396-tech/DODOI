"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Flag, MoreHorizontal, Settings, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { DropdownMenu } from "radix-ui";
import { useId, useState } from "react";

import { ConfirmDeleteDialog } from "@/components/companion/confirm-delete-dialog";
import { ReportDialog } from "@/components/reports/report-button";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBanner } from "@/components/ui/error-banner";
import { FieldError } from "@/components/ui/field-error";
import { Label, Textarea } from "@/components/ui/input";
import { PatternTile, type PatternAccent } from "@/components/ui/pattern-tile";
import { showToast } from "@/components/ui/toast";
import {
  createCommunityPost,
  deleteCommunity,
  getCommunity,
  joinCommunity,
  leaveCommunity,
  listCommunityPosts,
} from "@/lib/api-client/communities";
import { ApiRequestError } from "@/lib/api-client/request";
import { COMMUNITY_MAX_PHOTOS, COMMUNITY_POST_MAX } from "@/lib/schemas/communities";
import type { Paginated } from "@/lib/types/api";
import type { CommunityDetail, CommunityPostView, CommunityThread } from "@/lib/types/communities";
import type { Media } from "@/lib/types/media";

import { CommunityManageDialog } from "./community-manage-dialog";
import { CommunityPostItem } from "./community-post-item";
import { PhotoPicker } from "./photo-picker";

// A community page (COM-03…08, F-28): the craft, description and rules, Join / Leave, the ⋯ menu
// (Manage for the owner and moderators, Report, Delete for the owner), the composer and the
// discussions with one level of replies. Everyone signed in can read; a joined, verified member
// writes. Not designed; built from the system.

const MENU_ITEM =
  "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-sm px-3 text-control text-foreground outline-none data-highlighted:bg-muted";

function messageOf(caught: unknown, fallback: string): string {
  return caught instanceof ApiRequestError ? caught.message : fallback;
}

export function CommunityView({
  initialCommunity,
  initialPosts,
  isVerified,
}: {
  initialCommunity: CommunityDetail;
  initialPosts: Paginated<CommunityThread>;
  isVerified: boolean;
}) {
  const id = useId();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [community, setCommunity] = useState(initialCommunity);
  const [threads, setThreads] = useState(initialPosts.items);
  const [nextCursor, setNextCursor] = useState(initialPosts.nextCursor);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [body, setBody] = useState("");
  const [photos, setPhotos] = useState<Media[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [isReplying, setIsReplying] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"report" | "leave" | "delete" | "manage" | null>(null);

  const role = community.myRole;
  const isManager = role === "OWNER" || role === "MODERATOR";
  const accent = (community.skill?.accent.toLowerCase() ?? "butter") as PatternAccent;

  async function refreshCommunity() {
    try {
      setCommunity(await getCommunity(community.slug));
      await queryClient.invalidateQueries({ queryKey: ["communities"] });
    } catch (caught) {
      setError(messageOf(caught, "We couldn't refresh this community."));
    }
  }

  async function join() {
    setIsBusy(true);
    setError(null);
    try {
      await joinCommunity(community.slug);
      await refreshCommunity();
    } catch (caught) {
      setError(messageOf(caught, "We couldn't join. Try again."));
    } finally {
      setIsBusy(false);
    }
  }

  async function leave() {
    setIsBusy(true);
    try {
      await leaveCommunity(community.slug);
      setDialog(null);
      await refreshCommunity();
    } catch (caught) {
      setDialog(null);
      setError(messageOf(caught, "We couldn't leave. Try again."));
    } finally {
      setIsBusy(false);
    }
  }

  async function remove() {
    setIsBusy(true);
    try {
      await deleteCommunity(community.slug);
      await queryClient.invalidateQueries({ queryKey: ["communities"] });
      showToast({ message: "Community deleted" });
      router.replace("/community/circles");
    } catch (caught) {
      setIsBusy(false);
      setDialog(null);
      setError(messageOf(caught, "We couldn't delete that."));
    }
  }

  async function loadMore() {
    if (!nextCursor) return;
    setIsLoadingMore(true);
    try {
      const page = await listCommunityPosts(community.slug, nextCursor);
      setThreads((current) => [...current, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (caught) {
      showToast({ message: messageOf(caught, "We couldn't load more.") });
    } finally {
      setIsLoadingMore(false);
    }
  }

  async function post(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    setIsPosting(true);
    setFormError(null);
    try {
      const created = await createCommunityPost(community.slug, {
        body: body.trim(),
        mediaIds: photos.map((photo) => photo.id),
      });
      setThreads((current) => [{ ...created, replies: [] }, ...current]);
      setBody("");
      setPhotos([]);
    } catch (caught) {
      setFormError(messageOf(caught, "We couldn't post that. Try again."));
    } finally {
      setIsPosting(false);
    }
  }

  async function sendReply(event: React.FormEvent, parentId: string) {
    event.preventDefault();
    if (!replyBody.trim()) return;
    setIsReplying(true);
    setReplyError(null);
    try {
      const created = await createCommunityPost(community.slug, {
        body: replyBody.trim(),
        parentId,
      });
      setThreads((current) =>
        current.map((thread) =>
          thread.id === parentId ? { ...thread, replies: [...thread.replies, created] } : thread,
        ),
      );
      setReplyBody("");
      setReplyingTo(null);
    } catch (caught) {
      setReplyError(messageOf(caught, "We couldn't send that. Try again."));
    } finally {
      setIsReplying(false);
    }
  }

  function replacePost(updated: CommunityPostView) {
    setThreads((current) =>
      current.map((thread) =>
        thread.id === updated.id
          ? { ...updated, replies: thread.replies }
          : {
              ...thread,
              replies: thread.replies.map((reply) => (reply.id === updated.id ? updated : reply)),
            },
      ),
    );
  }

  function dropPost(postId: string) {
    setThreads((current) =>
      current
        .filter((thread) => thread.id !== postId)
        .map((thread) => ({
          ...thread,
          replies: thread.replies.filter((reply) => reply.id !== postId),
        })),
    );
  }

  const joinNotice = role
    ? null
    : community.isRemoved
      ? "You were removed from this community. Only the owner can let you back."
      : !isVerified
        ? "Verify your email to join and post."
        : null;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-start">
        <PatternTile accent={accent} className="size-16 shrink-0 md:size-20" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {community.skill ? (
            <span className="self-start rounded-full bg-lavender px-3 py-1 text-meta font-bold text-plum">
              {community.skill.name}
            </span>
          ) : null}
          <h1 className="text-title text-balance wrap-break-word text-foreground md:text-title-web">
            {community.name}
          </h1>
          <p className="text-body-lg wrap-break-word text-foreground md:text-body-lg-web">
            {community.description}
          </p>
        </div>
        <div className="flex items-center gap-2 md:pt-1">
          {role ? (
            <span className="rounded-full bg-mint px-3 py-1 text-meta font-bold text-foreground">
              {role === "OWNER" ? "Owner" : role === "MODERATOR" ? "Moderator" : "Joined"}
            </span>
          ) : community.canJoin ? (
            <Button disabled={isBusy} onClick={() => void join()}>
              {isBusy ? "Joining…" : "Join"}
            </Button>
          ) : null}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger
              aria-label="More options for this community"
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
                {isManager ? (
                  <DropdownMenu.Item className={MENU_ITEM} onSelect={() => setDialog("manage")}>
                    <Settings aria-hidden className="size-4.5" />
                    Manage
                  </DropdownMenu.Item>
                ) : null}
                {role === "MEMBER" || role === "MODERATOR" ? (
                  <DropdownMenu.Item className={MENU_ITEM} onSelect={() => setDialog("leave")}>
                    Leave community
                  </DropdownMenu.Item>
                ) : null}
                {role !== "OWNER" ? (
                  <DropdownMenu.Item className={MENU_ITEM} onSelect={() => setDialog("report")}>
                    <Flag aria-hidden className="size-4.5" />
                    Report community
                  </DropdownMenu.Item>
                ) : null}
                {role === "OWNER" ? (
                  <DropdownMenu.Item className={MENU_ITEM} onSelect={() => setDialog("delete")}>
                    <Trash2 aria-hidden className="size-4.5" />
                    Delete community
                  </DropdownMenu.Item>
                ) : null}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </header>

      {joinNotice ? (
        <p role="status" className="rounded-md bg-butter p-3.5 text-body text-foreground">
          {joinNotice}
        </p>
      ) : null}
      {error ? <ErrorBanner>{error}</ErrorBanner> : null}

      {community.rules.length > 0 ? (
        <details className="rounded-card border border-border bg-background p-4">
          <summary className="cursor-pointer text-control-lg font-bold text-foreground">
            Community rules ({community.rules.length})
          </summary>
          <ol className="mt-3 flex list-decimal flex-col gap-1.5 pl-5 text-body text-foreground">
            {community.rules.map((rule) => (
              <li key={rule} className="wrap-break-word">
                {rule}
              </li>
            ))}
          </ol>
        </details>
      ) : null}

      <section aria-labelledby={`${id}-discussions`} className="flex flex-col gap-4">
        <h2 id={`${id}-discussions`} className="text-section text-foreground">
          Discussions
        </h2>

        {community.canPost ? (
          <form
            method="post"
            onSubmit={post}
            className="flex flex-col gap-3 rounded-card border border-border bg-background p-4"
          >
            <Label htmlFor={`${id}-post`}>Start a discussion</Label>
            <Textarea
              id={`${id}-post`}
              value={body}
              rows={3}
              maxLength={COMMUNITY_POST_MAX}
              placeholder="Share a tip, a question or something you made…"
              onChange={(event) => setBody(event.target.value)}
            />
            <PhotoPicker
              photos={photos}
              max={COMMUNITY_MAX_PHOTOS}
              onChange={setPhotos}
              onError={setFormError}
              onBusyChange={setIsUploading}
            />
            <FieldError id={`${id}-post-error`}>{formError}</FieldError>
            <Button
              type="submit"
              disabled={isPosting || isUploading || body.trim() === ""}
              className="self-start"
            >
              {isPosting ? "Posting…" : "Post"}
            </Button>
          </form>
        ) : null}

        {threads.length === 0 ? (
          <EmptyState
            title="No discussions yet"
            description={
              community.canPost
                ? "Start the first one."
                : "Join this community to start the first one."
            }
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {threads.map((thread) => (
              <li key={thread.id}>
                <CommunityPostItem
                  slug={community.slug}
                  post={thread}
                  isReply={false}
                  isManager={isManager}
                  onChange={replacePost}
                  onDeleted={dropPost}
                >
                  {thread.replies.length > 0 ? (
                    <ul
                      aria-label="Replies"
                      className="mt-1 flex flex-col gap-3 border-l-2 border-border pl-3.5 md:pl-5"
                    >
                      {thread.replies.map((reply) => (
                        <li key={reply.id}>
                          <CommunityPostItem
                            slug={community.slug}
                            post={reply}
                            isReply
                            isManager={isManager}
                            onChange={replacePost}
                            onDeleted={dropPost}
                          />
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {community.canPost && !thread.isHidden ? (
                    replyingTo === thread.id ? (
                      <form
                        method="post"
                        onSubmit={(event) => void sendReply(event, thread.id)}
                        className="flex flex-col gap-2"
                      >
                        <Label htmlFor={`${id}-reply-${thread.id}`}>Your reply</Label>
                        <Textarea
                          id={`${id}-reply-${thread.id}`}
                          value={replyBody}
                          rows={3}
                          maxLength={COMMUNITY_POST_MAX}
                          onChange={(event) => setReplyBody(event.target.value)}
                        />
                        <FieldError id={`${id}-reply-error`}>{replyError}</FieldError>
                        <div className="flex gap-2">
                          <Button
                            type="submit"
                            size="sm"
                            disabled={isReplying || replyBody.trim() === ""}
                          >
                            {isReplying ? "Sending…" : "Send reply"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setReplyingTo(null);
                              setReplyError(null);
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <Button
                        variant="text"
                        size="sm"
                        className="self-start"
                        onClick={() => {
                          setReplyingTo(thread.id);
                          setReplyBody("");
                          setReplyError(null);
                        }}
                      >
                        Reply
                      </Button>
                    )
                  ) : null}
                </CommunityPostItem>
              </li>
            ))}
          </ul>
        )}

        {nextCursor ? (
          <Button
            variant="outline"
            className="self-center"
            disabled={isLoadingMore}
            onClick={() => void loadMore()}
          >
            {isLoadingMore ? "Loading…" : "Show more"}
          </Button>
        ) : null}
      </section>

      {dialog === "report" ? (
        <ReportDialog
          targetType="COMMUNITY"
          targetId={community.id}
          targetLabel="this community"
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog === "leave" ? (
        <ConfirmDeleteDialog
          title="Leave this community?"
          description="You can join again any time."
          confirmLabel="Leave"
          isBusy={isBusy}
          onConfirm={() => void leave()}
          onCancel={() => setDialog(null)}
        />
      ) : null}
      {dialog === "delete" ? (
        <ConfirmDeleteDialog
          title="Delete this community?"
          description="Every discussion, reply and photo in it is deleted for good. This can't be undone. To keep it, hand it to a moderator in Manage and leave instead."
          confirmLabel="Delete community"
          isBusy={isBusy}
          onConfirm={() => void remove()}
          onCancel={() => setDialog(null)}
        />
      ) : null}
      {dialog === "manage" && (role === "OWNER" || role === "MODERATOR") ? (
        <CommunityManageDialog
          slug={community.slug}
          myRole={role}
          onClose={() => setDialog(null)}
          onChanged={() => void refreshCommunity()}
        />
      ) : null}
    </div>
  );
}
