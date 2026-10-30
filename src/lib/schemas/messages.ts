import { z } from "zod";

// API contracts for direct messages (API_SPECIFICATION §9.3, P3-02; MSG-01…05).

export const MESSAGE_MAX = 1_000;

const id = z.string().min(1).max(40);

export const messagePolicySchema = z.enum(["EVERYONE", "FOLLOWING", "NOBODY"]);
export type MessagePolicyName = z.output<typeof messagePolicySchema>;

/** PUT /api/me/message-settings: who can message me (MSG-02). */
export const messageSettingsSchema = z.object({ messagePolicy: messagePolicySchema });
export type MessageSettingsInput = z.output<typeof messageSettingsSchema>;

/** POST /api/conversations: start (or reopen) a conversation with a member. */
export const startConversationSchema = z.object({
  username: z.string().trim().min(1).max(40),
});
export type StartConversationInput = z.output<typeof startConversationSchema>;

export const sendMessageSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Write a few words first.")
    .max(MESSAGE_MAX, `Keep it to ${MESSAGE_MAX} characters or fewer.`),
});
export type SendMessageInput = z.output<typeof sendMessageSchema>;

export const conversationListQuerySchema = z.object({ cursor: z.string().max(500).optional() });
export type ConversationListQuery = z.output<typeof conversationListQuerySchema>;

/**
 * GET /api/conversations/{id}/messages: the latest messages by default, `after` for polling
 * (messages newer than a cursor) and `before` for earlier ones.
 */
export const messagesQuerySchema = z
  .object({ after: z.string().max(500).optional(), before: z.string().max(500).optional() })
  .refine((query) => !(query.after && query.before), "Use either after or before.");
export type MessagesQuery = z.output<typeof messagesQuerySchema>;

export const conversationIdParamsSchema = z.object({ id });
export const messageIdParamsSchema = z.object({ id });
