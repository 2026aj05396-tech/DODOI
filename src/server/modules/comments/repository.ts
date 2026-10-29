import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db/client";

// Comment table. Posts belong to the content module: only the post id is stored and used here.

type Tx = Prisma.TransactionClient;

const commentSelect = {
  id: true,
  postId: true,
  parentId: true,
  authorId: true,
  body: true,
  editedAt: true,
  deletedAt: true,
  hiddenAt: true,
  createdAt: true,
} satisfies Prisma.CommentSelect;

export type CommentRow = Prisma.CommentGetPayload<{ select: typeof commentSelect }>;

export type CommentPosition = { createdAt: Date; id: string };

/** Hidden comments show only to the writer (MOD-04). */
function visibleTo(viewerId: string) {
  return { OR: [{ hiddenAt: null }, { authorId: viewerId }] } satisfies Prisma.CommentWhereInput;
}

/** Comments after a position, oldest first (keyset, stable when two share a timestamp). */
function after(position: CommentPosition | null): Prisma.CommentWhereInput {
  if (!position) return {};
  return {
    OR: [
      { createdAt: { gt: position.createdAt } },
      { createdAt: position.createdAt, id: { gt: position.id } },
    ],
  };
}

const oldestFirst = [
  { createdAt: "asc" },
  { id: "asc" },
] satisfies Prisma.CommentOrderByWithRelationInput[];

export async function findTopLevel(
  postId: string,
  viewerId: string,
  position: CommentPosition | null,
  take: number,
): Promise<CommentRow[]> {
  return db.comment.findMany({
    where: { postId, parentId: null, AND: [visibleTo(viewerId), after(position)] },
    orderBy: oldestFirst,
    take,
    select: commentSelect,
  });
}

export async function findReplies(
  parentId: string,
  viewerId: string,
  position: CommentPosition | null,
  take: number,
): Promise<CommentRow[]> {
  return db.comment.findMany({
    where: { parentId, AND: [visibleTo(viewerId), after(position)] },
    orderBy: oldestFirst,
    take,
    select: commentSelect,
  });
}

/** Visible replies per parent comment id. */
export async function countReplies(
  parentIds: string[],
  viewerId: string,
): Promise<Map<string, number>> {
  if (parentIds.length === 0) return new Map();
  const rows = await db.comment.groupBy({
    by: ["parentId"],
    where: { parentId: { in: parentIds }, ...visibleTo(viewerId) },
    _count: { _all: true },
  });
  return new Map(rows.flatMap((row) => (row.parentId ? [[row.parentId, row._count._all]] : [])));
}

export async function findComment(id: string, tx: Tx | typeof db = db): Promise<CommentRow | null> {
  return tx.comment.findUnique({ where: { id }, select: commentSelect });
}

/** Comments and replies that are still shown (not deleted, not hidden), for the public count (CMT-04). */
export async function countVisibleOnPost(postId: string): Promise<number> {
  return db.comment.count({ where: { postId, deletedAt: null, hiddenAt: null } });
}

export async function insertComment(data: {
  postId: string;
  authorId: string;
  parentId: string | null;
  body: string;
}): Promise<CommentRow> {
  return db.comment.create({ data, select: commentSelect });
}

export async function updateCommentBody(id: string, body: string): Promise<CommentRow> {
  return db.comment.update({
    where: { id },
    data: { body, editedAt: new Date() },
    select: commentSelect,
  });
}

export async function countRepliesOf(id: string, tx: Tx | typeof db = db): Promise<number> {
  return tx.comment.count({ where: { parentId: id } });
}

/** Soft delete (CMT-02): the text and the writer go, the row stays so the replies keep their place. */
export async function softDeleteComment(id: string, tx: Tx | typeof db = db): Promise<void> {
  await tx.comment.update({
    where: { id },
    data: { body: "", authorId: null, deletedAt: new Date() },
  });
}

export async function deleteCommentRow(id: string, tx: Tx | typeof db = db): Promise<void> {
  await tx.comment.delete({ where: { id } });
}

export async function findCommentsByAuthor(
  authorId: string,
  tx: Tx,
): Promise<{ id: string; parentId: string | null }[]> {
  return tx.comment.findMany({ where: { authorId }, select: { id: true, parentId: true } });
}
