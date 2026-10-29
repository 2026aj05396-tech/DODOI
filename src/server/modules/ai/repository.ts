import "server-only";

import type { AIContextType, AIMessageStatus, AIUsageStatus } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db/client";

// AI tables (ai_conversation, ai_message, ai_usage, ai_feedback, consent). Posts, skills and
// media belong to other modules: only their ids are stored here.

type Tx = Prisma.TransactionClient;

const messageSelect = {
  id: true,
  role: true,
  content: true,
  imageMediaId: true,
  status: true,
  createdAt: true,
  feedback: { select: { helpful: true } },
} satisfies Prisma.AIMessageSelect;

export type MessageRow = Prisma.AIMessageGetPayload<{ select: typeof messageSelect }>;

const conversationSelect = {
  id: true,
  userId: true,
  title: true,
  contextType: true,
  contextId: true,
  updatedAt: true,
} satisfies Prisma.AIConversationSelect;

export type ConversationRow = Prisma.AIConversationGetPayload<{
  select: typeof conversationSelect;
}>;

export async function findConversation(id: string): Promise<ConversationRow | null> {
  return db.aIConversation.findUnique({ where: { id }, select: conversationSelect });
}

export async function findConversations(
  userId: string,
  after: { updatedAt: Date; id: string } | null,
  take: number,
): Promise<ConversationRow[]> {
  return db.aIConversation.findMany({
    where: {
      userId,
      ...(after
        ? {
            OR: [
              { updatedAt: { lt: after.updatedAt } },
              { updatedAt: after.updatedAt, id: { lt: after.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take,
    select: conversationSelect,
  });
}

export async function findMessages(conversationId: string): Promise<MessageRow[]> {
  return db.aIMessage.findMany({
    where: { conversationId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: messageSelect,
  });
}

/** The newest `take` messages that were answered normally, oldest first (prompt history). */
export async function findRecentMessages(conversationId: string, take: number) {
  const rows = await db.aIMessage.findMany({
    where: { conversationId, status: "OK" },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
    select: { role: true, content: true, imageMediaId: true },
  });
  return rows.reverse();
}

export async function findMessageForFeedback(id: string) {
  return db.aIMessage.findUnique({
    where: { id },
    select: { id: true, role: true, conversation: { select: { userId: true } } },
  });
}

export async function upsertFeedback(data: {
  messageId: string;
  userId: string;
  helpful: boolean;
  comment: string | null;
}): Promise<void> {
  await db.aIFeedback.upsert({
    where: { messageId: data.messageId },
    create: data,
    update: { helpful: data.helpful, comment: data.comment },
  });
}

export async function insertConversationWithMessages(
  tx: Tx,
  input: {
    conversationId: string | null;
    userId: string;
    title: string;
    contextType: AIContextType;
    contextId: string | null;
    messages: {
      role: "USER" | "ASSISTANT";
      content: string;
      imageMediaId: string | null;
      promptVersion: string | null;
      status: AIMessageStatus;
    }[];
  },
) {
  const conversation = input.conversationId
    ? await tx.aIConversation.update({
        where: { id: input.conversationId },
        // Touches updatedAt: the 30-day retention clock restarts with each message.
        data: { updatedAt: new Date() },
        select: conversationSelect,
      })
    : await tx.aIConversation.create({
        data: {
          userId: input.userId,
          title: input.title,
          contextType: input.contextType,
          contextId: input.contextId,
        },
        select: conversationSelect,
      });
  const created: MessageRow[] = [];
  for (const [index, message] of input.messages.entries()) {
    created.push(
      await tx.aIMessage.create({
        data: {
          conversationId: conversation.id,
          ...message,
          // Keeps the order stable when two messages are written in the same millisecond.
          createdAt: new Date(Date.now() + index),
        },
        select: messageSelect,
      }),
    );
  }
  return { conversation, messages: created };
}

export async function insertUsage(data: {
  userId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costMicros: number;
  latencyMs: number;
  status: AIUsageStatus;
  hasImage: boolean;
}): Promise<void> {
  await db.aIUsage.create({ data });
}

/** Requests that reached the provider (or its filters) since `since`: what the global cap counts. */
export async function countProviderRequestsSince(since: Date): Promise<number> {
  return db.aIUsage.count({ where: { createdAt: { gte: since }, status: { not: "QUOTA" } } });
}

export async function findActiveConsents(userId: string) {
  return db.consent.findMany({
    where: { userId, revokedAt: null },
    select: { type: true },
  });
}

export async function upsertConsent(
  userId: string,
  type: "AI_IMAGES" | "AI_PROFILE_CONTEXT",
  granted: boolean,
  policyVersion: string,
  now: Date,
): Promise<void> {
  if (granted) {
    await db.consent.upsert({
      where: { userId_type: { userId, type } },
      create: { userId, type, policyVersion, grantedAt: now },
      update: { policyVersion, grantedAt: now, revokedAt: null },
    });
  } else {
    await db.consent.updateMany({
      where: { userId, type, revokedAt: null },
      data: { revokedAt: now },
    });
  }
}

/** Photos of these conversations, so they can be deleted with them. */
export async function findImageIdsOfConversations(where: Prisma.AIConversationWhereInput) {
  const rows = await db.aIMessage.findMany({
    where: { conversation: where, imageMediaId: { not: null } },
    select: { imageMediaId: true },
  });
  return rows.flatMap((row) => (row.imageMediaId ? [row.imageMediaId] : []));
}

export async function deleteConversations(where: Prisma.AIConversationWhereInput): Promise<number> {
  const { count } = await db.aIConversation.deleteMany({ where });
  return count;
}

export async function deleteUsageBefore(cutoff: Date): Promise<number> {
  const { count } = await db.aIUsage.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return count;
}
