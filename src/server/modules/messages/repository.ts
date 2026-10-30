import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db/client";

// conversation and message tables (P3-02). People belong to other modules: only their ids are
// stored here. A conversation row holds the smaller user id as A, so one row exists per pair.

type Tx = Prisma.TransactionClient;

const conversationSelect = {
  id: true,
  userAId: true,
  userBId: true,
  lastMessageAt: true,
  hiddenForA: true,
  hiddenForB: true,
  lastReadAtA: true,
  lastReadAtB: true,
} satisfies Prisma.ConversationSelect;

export type ConversationRow = Prisma.ConversationGetPayload<{ select: typeof conversationSelect }>;

export function pairOf(first: string, second: string): { userAId: string; userBId: string } {
  return first < second ? { userAId: first, userBId: second } : { userAId: second, userBId: first };
}

export async function findConversationByPair(
  first: string,
  second: string,
): Promise<ConversationRow | null> {
  return db.conversation.findUnique({
    where: { userAId_userBId: pairOf(first, second) },
    select: conversationSelect,
  });
}

/**
 * Your conversations with each of `peerIds`, keyed by the peer's user id, and whether the peer
 * has written in it (MSG-02 lets someone who wrote be answered whatever their setting says).
 */
export async function findConversationsWithPeers(
  userId: string,
  peerIds: string[],
): Promise<Map<string, { id: string; peerHasWritten: boolean }>> {
  if (peerIds.length === 0) return new Map();
  const rows = await db.conversation.findMany({
    where: {
      OR: [
        { userAId: userId, userBId: { in: peerIds } },
        { userBId: userId, userAId: { in: peerIds } },
      ],
    },
    select: { id: true, userAId: true, userBId: true },
  });
  if (rows.length === 0) return new Map();
  const writers = await db.message.groupBy({
    by: ["conversationId", "senderId"],
    where: { conversationId: { in: rows.map((row) => row.id) }, senderId: { not: userId } },
  });
  const wrote = new Set(writers.map((row) => row.conversationId));
  return new Map(
    rows.map((row) => [
      row.userAId === userId ? row.userBId : row.userAId,
      { id: row.id, peerHasWritten: wrote.has(row.id) },
    ]),
  );
}

export async function findConversationById(id: string): Promise<ConversationRow | null> {
  return db.conversation.findUnique({ where: { id }, select: conversationSelect });
}

/** Creates the pair's conversation, or returns the one that a concurrent request just made. */
export async function insertConversation(first: string, second: string): Promise<ConversationRow> {
  const pair = pairOf(first, second);
  await db.conversation.createMany({ data: [pair], skipDuplicates: true });
  return db.conversation.findUniqueOrThrow({
    where: { userAId_userBId: pair },
    select: conversationSelect,
  });
}

export type ConversationPosition = { lastMessageAt: Date; id: string };

/** The member's conversations that have at least one message and are not hidden for them. */
export async function findConversationsFor(options: {
  userId: string;
  after: ConversationPosition | null;
  take: number;
}): Promise<ConversationRow[]> {
  const { userId, after, take } = options;
  return db.conversation.findMany({
    where: {
      messages: { some: {} },
      AND: [
        {
          OR: [
            { userAId: userId, hiddenForA: false },
            { userBId: userId, hiddenForB: false },
          ],
        },
        ...(after
          ? [
              {
                OR: [
                  { lastMessageAt: { lt: after.lastMessageAt } },
                  { lastMessageAt: after.lastMessageAt, id: { lt: after.id } },
                ],
              },
            ]
          : []),
      ],
    },
    orderBy: [{ lastMessageAt: "desc" }, { id: "desc" }],
    take,
    select: conversationSelect,
  });
}

/** The newest message of each conversation, for the list. */
export async function findLastMessages(conversationIds: string[]) {
  if (conversationIds.length === 0) return [];
  return db.message.findMany({
    where: { conversationId: { in: conversationIds } },
    orderBy: [{ conversationId: "asc" }, { createdAt: "desc" }, { id: "desc" }],
    distinct: ["conversationId"],
    select: { conversationId: true, senderId: true, body: true, deletedAt: true, createdAt: true },
  });
}

/** When the other person's newest message in each conversation arrived (for the unread dot). */
export async function findLatestFromOthers(conversationIds: string[], userId: string) {
  if (conversationIds.length === 0) return [];
  return db.message.findMany({
    where: { conversationId: { in: conversationIds }, senderId: { not: userId }, deletedAt: null },
    orderBy: [{ conversationId: "asc" }, { createdAt: "desc" }],
    distinct: ["conversationId"],
    select: { conversationId: true, createdAt: true },
  });
}

const messageSelect = {
  id: true,
  conversationId: true,
  senderId: true,
  body: true,
  deletedAt: true,
  createdAt: true,
} satisfies Prisma.MessageSelect;

export type MessageRow = Prisma.MessageGetPayload<{ select: typeof messageSelect }>;
export type MessagePosition = { createdAt: Date; id: string };

/** Messages oldest first: the latest `take`, those after a position, or those before one. */
export async function findMessages(options: {
  conversationId: string;
  after: MessagePosition | null;
  before: MessagePosition | null;
  take: number;
}): Promise<MessageRow[]> {
  const { conversationId, after, before, take } = options;
  if (after) {
    return db.message.findMany({
      where: {
        conversationId,
        OR: [
          { createdAt: { gt: after.createdAt } },
          { createdAt: after.createdAt, id: { gt: after.id } },
        ],
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take,
      select: messageSelect,
    });
  }
  const rows = await db.message.findMany({
    where: {
      conversationId,
      ...(before
        ? {
            OR: [
              { createdAt: { lt: before.createdAt } },
              { createdAt: before.createdAt, id: { lt: before.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
    select: messageSelect,
  });
  return rows.reverse();
}

export async function findMessage(id: string): Promise<MessageRow | null> {
  return db.message.findUnique({ where: { id }, select: messageSelect });
}

export async function countMessagesBy(conversationId: string, senderId: string): Promise<number> {
  return db.message.count({ where: { conversationId, senderId } });
}

export async function countMessagesNotBy(
  conversationId: string,
  senderId: string,
): Promise<number> {
  return db.message.count({ where: { conversationId, senderId: { not: senderId } } });
}

/** Adds a message and brings the conversation back for both sides. */
export async function insertMessage(data: {
  conversationId: string;
  senderId: string;
  body: string;
}): Promise<MessageRow> {
  return db.$transaction(async (tx: Tx) => {
    const row = await tx.message.create({ data, select: messageSelect });
    await tx.conversation.update({
      where: { id: data.conversationId },
      data: { lastMessageAt: row.createdAt, hiddenForA: false, hiddenForB: false },
    });
    return row;
  });
}

export async function eraseMessage(id: string): Promise<void> {
  await db.message.update({ where: { id }, data: { body: "", deletedAt: new Date() } });
}

export async function markRead(conversationId: string, side: "A" | "B"): Promise<void> {
  await db.conversation.update({
    where: { id: conversationId },
    data: side === "A" ? { lastReadAtA: new Date() } : { lastReadAtB: new Date() },
  });
}

export async function setHidden(
  conversationId: string,
  side: "A" | "B",
  hidden: boolean,
): Promise<void> {
  await db.conversation.update({
    where: { id: conversationId },
    data: side === "A" ? { hiddenForA: hidden } : { hiddenForB: hidden },
  });
}

// --- Reports -----------------------------------------------------------------------------------------

export async function findMessagesForModeration(ids: string[]) {
  if (ids.length === 0) return [];
  return db.message.findMany({ where: { id: { in: ids } }, select: messageSelect });
}

/** Up to `take` messages before a message, newest first, in the same conversation. */
export async function findMessagesBefore(row: MessageRow, take: number): Promise<MessageRow[]> {
  return db.message.findMany({
    where: {
      conversationId: row.conversationId,
      OR: [{ createdAt: { lt: row.createdAt } }, { createdAt: row.createdAt, id: { lt: row.id } }],
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
    select: messageSelect,
  });
}
