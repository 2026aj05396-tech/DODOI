"use client";

import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Skeleton } from "@/components/ui/skeleton";
import { showToast } from "@/components/ui/toast";
import {
  addComment,
  editComment,
  listComments,
  listReplies,
  removeComment,
} from "@/lib/api-client/comments";
import { ApiRequestError } from "@/lib/api-client/request";
import type { Paginated } from "@/lib/types/api";
import type { Comment } from "@/lib/types/comments";

import { CommentComposer } from "./comment-composer";
import { CommentItem } from "./comment-item";

// Comments on a post (F-19, CMT-01…05; USER_FLOWS F-19 step 1): below related posts on phones and
// tablets, below the steps from 1024px. Oldest first, 20 at a time, replies one level deep under
// their comment. Reading needs a signed-in user (OD-29), writing a verified email (OD-08).

const DESKTOP = "(min-width: 1024px)";

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(DESKTOP);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Null while rendering on the server, where the width is unknown. */
function useIsDesktop(): boolean | null {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DESKTOP).matches,
    () => null,
  );
}

type Status = "loading" | "ready" | "error";
type ReplyTarget = { threadId: string; mention: string };

function mergeById(current: Comment[], incoming: Comment[]): Comment[] {
  const known = new Set(current.map((comment) => comment.id));
  return [...current, ...incoming.filter((comment) => !known.has(comment.id))];
}

/** A comment posted while more pages were still to load can come back again with its page. */
function uniqueById(comments: Comment[]): Comment[] {
  return [...new Map(comments.map((comment) => [comment.id, comment])).values()];
}

/** Replying starts with @username (CMT-01); a reply to a reply answers the same comment. */
function mentionFor(comment: Comment): string {
  return comment.author ? `@${comment.author.username} ` : "";
}

/** Replies not shown yet; "more" stays available while the server has another page. */
function remainingReplies(thread: Comment, cursors: Record<string, string | null>): number {
  const missing = thread.replyCount - thread.replies.length;
  if (missing > 0) return missing;
  return cursors[thread.id] ? 1 : 0;
}

function failed(error: unknown, fallback: string): void {
  showToast({ message: error instanceof ApiRequestError ? error.message : fallback });
}

export function CommentsSection({
  postId,
  initialCount,
  isSignedIn,
  isVerified,
  placement,
}: {
  postId: string;
  initialCount: number;
  isSignedIn: boolean;
  isVerified: boolean;
  /** "page" is below the related posts (under 1024px), "column" below the steps (from 1024px). */
  placement: "page" | "column";
}) {
  const isDesktop = useIsDesktop();
  if (isDesktop === null || isDesktop !== (placement === "column")) return null;
  return (
    <CommentsThread
      postId={postId}
      initialCount={initialCount}
      isSignedIn={isSignedIn}
      isVerified={isVerified}
      placement={placement}
    />
  );
}

function CommentsThread({
  postId,
  initialCount,
  isSignedIn,
  isVerified,
  placement,
}: {
  postId: string;
  initialCount: number;
  isSignedIn: boolean;
  isVerified: boolean;
  placement: "page" | "column";
}) {
  const queryClient = useQueryClient();
  const queryKey = ["comments", postId];
  // Kept in the query cache, not component state, so it survives the thread moving between its
  // two placements when the window is resized past 1024px.
  const countKey = ["comments-count", postId];
  const { data: count = initialCount } = useQuery({
    queryKey: countKey,
    queryFn: () => initialCount,
    initialData: initialCount,
    staleTime: Infinity,
  });
  function changeCount(by: number) {
    queryClient.setQueryData<number>(countKey, (current) =>
      Math.max((current ?? initialCount) + by, 0),
    );
  }
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  /** Where "more replies" continues per comment; absent until its replies were opened. */
  const [replyCursors, setReplyCursors] = useState<Record<string, string | null>>({});

  const comments = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => listComments(postId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: isSignedIn,
    staleTime: Infinity,
  });
  const items = uniqueById(comments.data?.pages.flatMap((page) => page.items) ?? []);
  const status: Status =
    comments.isError && !comments.data ? "error" : comments.isPending ? "loading" : "ready";
  const isLoadingMore = comments.isFetchingNextPage;

  async function loadMore() {
    const result = await comments.fetchNextPage();
    if (result.isError) failed(result.error, "We couldn't load more comments.");
  }

  /** Changes the comments already loaded, keeping the pages as they came. */
  function patchItems(change: (items: Comment[]) => Comment[]) {
    queryClient.setQueryData<InfiniteData<Paginated<Comment>, string | null>>(
      queryKey,
      (data) =>
        data && {
          ...data,
          pages: data.pages.map((page) => ({ ...page, items: change(page.items) })),
        },
    );
  }

  function updateThread(threadId: string, change: (thread: Comment) => Comment | null) {
    patchItems((current) =>
      current.flatMap((thread) => {
        if (thread.id !== threadId) return [thread];
        const next = change(thread);
        return next ? [next] : [];
      }),
    );
  }

  async function post(body: string) {
    const comment = await addComment(postId, body);
    queryClient.setQueryData<InfiniteData<Paginated<Comment>, string | null>>(queryKey, (data) => {
      if (!data) return data;
      const last = data.pages.length - 1;
      return {
        ...data,
        pages: data.pages.map((page, index) =>
          index === last ? { ...page, items: [...page.items, comment] } : page,
        ),
      };
    });
    changeCount(1);
  }

  async function reply(target: ReplyTarget, body: string) {
    await addComment(postId, body, target.threadId);
    const page = await listReplies(target.threadId, null);
    updateThread(target.threadId, (thread) => ({
      ...thread,
      replies: page.items,
      replyCount: thread.replyCount + 1,
    }));
    setReplyCursors((current) => ({ ...current, [target.threadId]: page.nextCursor }));
    changeCount(1);
    setReplyTarget(null);
  }

  async function showMoreReplies(thread: Comment) {
    const hasOpened = thread.id in replyCursors;
    try {
      const page = await listReplies(
        thread.id,
        hasOpened ? (replyCursors[thread.id] ?? null) : null,
      );
      updateThread(thread.id, (current) => ({
        ...current,
        replies: hasOpened ? mergeById(current.replies, page.items) : page.items,
      }));
      setReplyCursors((current) => ({ ...current, [thread.id]: page.nextCursor }));
    } catch (error) {
      failed(error, "We couldn't load the replies.");
    }
  }

  function replaceText(edited: Comment) {
    const apply = (comment: Comment): Comment =>
      comment.id === edited.id
        ? { ...comment, body: edited.body, editedAt: edited.editedAt }
        : comment;
    patchItems((current) =>
      current.map((thread) => ({ ...apply(thread), replies: thread.replies.map(apply) })),
    );
  }

  async function edit(comment: Comment, body: string) {
    replaceText(await editComment(comment.id, body));
  }

  async function remove(comment: Comment) {
    try {
      await removeComment(comment.id);
    } catch (error) {
      failed(error, "We couldn't delete that comment.");
      return;
    }
    changeCount(-1);
    if (comment.parentId) {
      updateThread(comment.parentId, (thread) => {
        const replies = thread.replies.filter((item) => item.id !== comment.id);
        const replyCount = Math.max(thread.replyCount - 1, 0);
        // A "Comment deleted" left without replies goes too (service does the same).
        if (thread.isDeleted && replyCount === 0) return null;
        return { ...thread, replies, replyCount };
      });
    } else {
      updateThread(comment.id, (thread) =>
        thread.replyCount > 0
          ? { ...thread, body: null, isDeleted: true, author: null, canDelete: false }
          : null,
      );
    }
    showToast({ message: "Comment deleted" });
  }

  const canWrite = isSignedIn && isVerified;
  const headingId = `comments-${placement}`;

  return (
    <section
      id={placement === "page" ? "comments" : undefined}
      aria-labelledby={headingId}
      className={
        placement === "page"
          ? "mx-auto max-w-2xl px-5 pt-10 md:px-7 md:pt-14 lg:max-w-6xl"
          : "border-t border-muted pt-6"
      }
    >
      <h2 id={headingId} className="text-section text-foreground">
        Comments ({count})
      </h2>

      {!isSignedIn ? (
        <p className="mt-3 text-body text-foreground-secondary">
          <Link
            href={`/sign-in?returnTo=${encodeURIComponent(`/p/${postId}`)}`}
            className="font-bold text-foreground underline"
          >
            Sign in
          </Link>{" "}
          to read and join the comments.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-5">
          {canWrite ? (
            <CommentComposer label="Add a comment" submitLabel="Post" onSubmit={post} />
          ) : (
            <p className="text-body text-foreground-secondary">Verify your email to comment.</p>
          )}

          {status === "loading" ? (
            <div role="status" aria-label="Loading comments" className="flex flex-col gap-4">
              <Skeleton className="h-14 w-full rounded-md" />
              <Skeleton className="h-14 w-full rounded-md" />
            </div>
          ) : null}

          {status === "error" ? (
            <ErrorBanner role="alert" className="flex items-center justify-between gap-3">
              <span>We couldn&apos;t load the comments.</span>
              <Button variant="outline" size="sm" onClick={() => void comments.refetch()}>
                Try again
              </Button>
            </ErrorBanner>
          ) : null}

          {status === "ready" && items.length === 0 ? (
            <p className="text-body text-foreground-secondary">
              No comments yet. Be the first to say something.
            </p>
          ) : null}

          {items.length > 0 ? (
            <ul className="flex flex-col gap-5">
              {items.map((thread) => (
                <li key={thread.id} className="flex flex-col gap-3">
                  <CommentItem
                    comment={thread}
                    canReply={canWrite}
                    onReply={(comment) =>
                      setReplyTarget({ threadId: thread.id, mention: mentionFor(comment) })
                    }
                    onEdit={edit}
                    onDelete={remove}
                  />
                  {thread.replies.length > 0 || thread.replyCount > 0 ? (
                    <div className="ml-4 flex flex-col gap-3 border-l-2 border-muted pl-4 md:ml-11">
                      {thread.replies.map((replyComment) => (
                        <CommentItem
                          key={replyComment.id}
                          comment={replyComment}
                          canReply={canWrite}
                          onReply={(comment) =>
                            setReplyTarget({ threadId: thread.id, mention: mentionFor(comment) })
                          }
                          onEdit={edit}
                          onDelete={remove}
                        />
                      ))}
                      {remainingReplies(thread, replyCursors) > 0 ? (
                        <button
                          type="button"
                          onClick={() => void showMoreReplies(thread)}
                          className="min-h-11 self-start rounded-sm text-control-sm font-bold text-muted-foreground hover:text-foreground"
                        >
                          View{" "}
                          {remainingReplies(thread, replyCursors) === 1
                            ? "1 more reply"
                            : `${remainingReplies(thread, replyCursors)} more replies`}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  {replyTarget?.threadId === thread.id ? (
                    <div className="ml-4 md:ml-11">
                      <CommentComposer
                        key={replyTarget.mention}
                        label={`Reply to thread ${thread.id}`}
                        placeholder="Add a reply"
                        submitLabel="Reply"
                        initialValue={replyTarget.mention}
                        autoFocus
                        onSubmit={(body) => reply(replyTarget, body)}
                        onCancel={() => setReplyTarget(null)}
                      />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}

          {comments.hasNextPage ? (
            <Button
              variant="outline"
              className="self-center"
              disabled={isLoadingMore}
              onClick={() => void loadMore()}
            >
              {isLoadingMore ? "Loading…" : "Show more comments"}
            </Button>
          ) : null}
        </div>
      )}
    </section>
  );
}
