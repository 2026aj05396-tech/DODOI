import "server-only";

import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants/pagination";
import type { CommentPageQuery, CreateCommentInput } from "@/lib/schemas/comments";
import { INLINE_REPLY_COUNT } from "@/lib/schemas/comments";
import type { Paginated } from "@/lib/types/api";
import type { Comment } from "@/lib/types/comments";
import type { CreatorSummary } from "@/lib/types/posts";
import { db } from "@/server/db/client";
import type { Actor, AuthenticatedActor } from "@/server/lib/actor";
import {
  ForbiddenError,
  NotFoundError,
  UnauthenticatedError,
  UnprocessableError,
} from "@/server/lib/errors";
import { decodeCursor, encodeCursor } from "@/server/lib/pagination";
import { enforceRateLimit, type RateLimitRule } from "@/server/lib/rate-limit";
import { avatarUrl, getPublishedPostAuthor } from "@/server/modules/content";
import { getCreatorProfiles } from "@/server/modules/users";

import { canDeleteComment, canEditComment } from "./policies";
import {
  countReplies,
  countRepliesOf,
  countVisibleOnPost,
  deleteCommentRow,
  findComment,
  findCommentsByAuthor,
  findReplies,
  findTopLevel,
  insertComment,
  softDeleteComment,
  updateCommentBody,
  type CommentPosition,
  type CommentRow,
} from "./repository";

// Comments (P2-04; PRODUCT_REQUIREMENTS CMT-01…05, API_SPECIFICATION §9.1). One level of replies
// (OD-25): a reply to a reply is attached to the comment above it. Only published posts have
// comments; reading needs a signed-in user (OD-29), writing a verified email (OD-08).

/** CMT-05: 30 comments an hour per user. */
export const COMMENT_RATE_LIMIT: RateLimitRule = {
  name: "comment-create",
  limit: 30,
  windowSeconds: 60 * 60,
};

const cursorSchema = z.object({ createdAt: z.iso.datetime(), id: z.string().min(1).max(40) });

function requireSignedIn(actor: Actor): AuthenticatedActor {
  if (!actor) throw new UnauthenticatedError();
  return actor;
}

function commentNotFound(): NotFoundError {
  return new NotFoundError("We couldn't find that comment.");
}

function toPosition(cursor: string | undefined): CommentPosition | null {
  if (!cursor) return null;
  const decoded = decodeCursor(cursor, cursorSchema);
  return { createdAt: new Date(decoded.createdAt), id: decoded.id };
}

function nextCursor(rows: CommentRow[], pageSize: number): string | null {
  const last = rows[pageSize - 1];
  if (rows.length <= pageSize || !last) return null;
  return encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id });
}

/** Throws 404 unless the post is published; returns who wrote it. */
async function requirePublishedPost(postId: string): Promise<{ authorId: string | null }> {
  const post = await getPublishedPostAuthor(postId);
  if (!post) throw new NotFoundError("We couldn't find that post.");
  return post;
}

async function toCommentViews(
  actor: AuthenticatedActor,
  rows: CommentRow[],
  postAuthorId: string | null,
  extra: { replyCounts?: Map<string, number>; replies?: Map<string, CommentRow[]> } = {},
): Promise<Comment[]> {
  const allRows = [...rows, ...[...(extra.replies?.values() ?? [])].flat()];
  const authorIds = allRows.flatMap((row) =>
    row.authorId && !row.deletedAt ? [row.authorId] : [],
  );
  const creators = await getCreatorProfiles([...new Set(authorIds)]);

  const toView = (row: CommentRow, replies: Comment[]): Comment => {
    const isDeleted = row.deletedAt !== null;
    const profile = !isDeleted && row.authorId ? creators.get(row.authorId) : undefined;
    const author: CreatorSummary | null = profile
      ? {
          username: profile.username,
          displayName: profile.displayName,
          avatarUrl: profile.avatarPublicId ? avatarUrl(profile.avatarPublicId) : null,
        }
      : null;
    return {
      id: row.id,
      postId: row.postId,
      parentId: row.parentId,
      body: isDeleted ? null : row.body,
      isDeleted,
      author,
      createdAt: row.createdAt.toISOString(),
      editedAt: row.editedAt?.toISOString() ?? null,
      isOwn: row.authorId === actor.id,
      canDelete: !isDeleted && canDeleteComment(actor, row, postAuthorId),
      replyCount: extra.replyCounts?.get(row.id) ?? 0,
      replies,
    };
  };

  return rows.map((row) =>
    toView(
      row,
      (extra.replies?.get(row.id) ?? []).map((reply) => toView(reply, [])),
    ),
  );
}

/** Top-level comments, oldest first, each with its reply count and first replies (CMT-01, CMT-04). */
export async function listComments(
  actor: Actor,
  postId: string,
  query: CommentPageQuery,
): Promise<Paginated<Comment>> {
  const user = requireSignedIn(actor);
  const post = await requirePublishedPost(postId);
  const rows = await findTopLevel(postId, user.id, toPosition(query.cursor), DEFAULT_PAGE_SIZE + 1);
  const page = rows.slice(0, DEFAULT_PAGE_SIZE);

  const ids = page.map((row) => row.id);
  const replyCounts = await countReplies(ids, user.id);
  const replies = new Map<string, CommentRow[]>();
  await Promise.all(
    page
      .filter((row) => (replyCounts.get(row.id) ?? 0) > 0)
      .map(async (row) => {
        replies.set(row.id, await findReplies(row.id, user.id, null, INLINE_REPLY_COUNT));
      }),
  );

  return {
    items: await toCommentViews(user, page, post.authorId, { replyCounts, replies }),
    nextCursor: nextCursor(rows, DEFAULT_PAGE_SIZE),
  };
}

/** More replies under one comment, oldest first. Without a cursor it starts from the first reply. */
export async function listReplies(
  actor: Actor,
  commentId: string,
  query: CommentPageQuery,
): Promise<Paginated<Comment>> {
  const user = requireSignedIn(actor);
  const parent = await findComment(commentId);
  if (!parent || parent.parentId) throw commentNotFound();
  const post = await requirePublishedPost(parent.postId);
  const rows = await findReplies(
    commentId,
    user.id,
    toPosition(query.cursor),
    DEFAULT_PAGE_SIZE + 1,
  );
  const page = rows.slice(0, DEFAULT_PAGE_SIZE);
  return {
    items: await toCommentViews(user, page, post.authorId),
    nextCursor: nextCursor(rows, DEFAULT_PAGE_SIZE),
  };
}

/** The public comment count on a post (CMT-04): comments and replies still shown. */
export async function getCommentCount(postId: string): Promise<number> {
  return countVisibleOnPost(postId);
}

export async function createComment(
  actor: Actor,
  postId: string,
  input: CreateCommentInput,
): Promise<Comment> {
  const user = requireSignedIn(actor);
  if (!user.isEmailVerified) {
    throw new ForbiddenError("Verify your email to comment.", { code: "EMAIL_NOT_VERIFIED" });
  }
  const post = await requirePublishedPost(postId);

  let parentId: string | null = null;
  if (input.parentId) {
    const target = await findComment(input.parentId);
    if (!target || target.postId !== postId) throw commentNotFound();
    if (target.deletedAt) {
      throw new UnprocessableError("That comment was deleted, so it can't get new replies.");
    }
    // A reply to a reply answers the comment above it (OD-25).
    parentId = target.parentId ?? target.id;
  }

  await enforceRateLimit(COMMENT_RATE_LIMIT, user.id);
  const row = await insertComment({ postId, authorId: user.id, parentId, body: input.body });
  const [view] = await toCommentViews(user, [row], post.authorId);
  if (!view) throw new Error("Comment view missing");
  return view;
}

export async function updateComment(actor: Actor, id: string, body: string): Promise<Comment> {
  const user = requireSignedIn(actor);
  const comment = await findComment(id);
  if (!comment || comment.deletedAt || !canEditComment(user, comment)) throw commentNotFound();
  const post = await requirePublishedPost(comment.postId);
  const row = await updateCommentBody(id, body);
  const replyCounts = comment.parentId ? undefined : await countReplies([id], user.id);
  const [view] = await toCommentViews(user, [row], post.authorId, { replyCounts });
  if (!view) throw new Error("Comment view missing");
  return view;
}

/**
 * Deletes a comment (CMT-02, CMT-03). A comment with replies is kept as "Comment deleted" so the
 * replies stay; anything else is removed, and a "Comment deleted" left without replies goes too.
 */
async function removeComment(row: CommentRow, tx: Prisma.TransactionClient): Promise<void> {
  if (!row.parentId) {
    if ((await countRepliesOf(row.id, tx)) > 0) await softDeleteComment(row.id, tx);
    else await deleteCommentRow(row.id, tx);
    return;
  }
  await deleteCommentRow(row.id, tx);
  const parent = await findComment(row.parentId, tx);
  if (parent?.deletedAt && (await countRepliesOf(parent.id, tx)) === 0) {
    await deleteCommentRow(parent.id, tx);
  }
}

export async function deleteComment(actor: Actor, id: string): Promise<void> {
  const user = requireSignedIn(actor);
  const comment = await findComment(id);
  if (!comment || comment.deletedAt) throw commentNotFound();
  const post = await requirePublishedPost(comment.postId);
  if (!canDeleteComment(user, comment, post.authorId)) throw commentNotFound();
  await db.$transaction((tx) => removeComment(comment, tx));
}

/**
 * Account deletion (DATABASE_SCHEMA §9.1): the user's replies are deleted, then their comments —
 * those other people replied to stay as "Comment deleted", the rest are deleted.
 */
export async function deleteCommentsOfUser(
  userId: string,
  tx: Prisma.TransactionClient,
): Promise<void> {
  const mine = await findCommentsByAuthor(userId, tx);
  const replies = mine.filter((comment) => comment.parentId);
  const topLevel = mine.filter((comment) => !comment.parentId);
  for (const { id } of [...replies, ...topLevel]) {
    const row = await findComment(id, tx);
    if (row && !row.deletedAt) await removeComment(row, tx);
  }
}
