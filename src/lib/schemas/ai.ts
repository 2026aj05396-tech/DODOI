import { z } from "zod";

// API contracts for the AI companion (API_SPECIFICATION §9.2, P4-01; AIC-01…09).

export const AI_TEXT_MAX_LENGTH = 1_000;
export const AI_FEEDBACK_COMMENT_MAX_LENGTH = 300;

const id = z.string().min(1).max(40);

export const aiContextSchema = z.object({ type: z.enum(["POST", "SKILL"]), id });
export type AIContextInput = z.output<typeof aiContextSchema>;

/**
 * POST /api/ai/messages. Without `conversationId` a new conversation starts, and its context (the
 * post or skill asked about) is fixed for its life.
 */
export const sendAIMessageSchema = z
  .object({
    conversationId: id.optional(),
    text: z
      .string()
      .trim()
      .min(1, "Write your question first.")
      .max(AI_TEXT_MAX_LENGTH, `Keep your question to ${AI_TEXT_MAX_LENGTH} characters or fewer.`),
    context: aiContextSchema.optional(),
    imageMediaId: id.optional(),
  })
  .refine((input) => !(input.conversationId && input.context), {
    path: ["context"],
    message: "A conversation's context can't be changed. Start a new conversation.",
  });
export type SendAIMessageInput = z.output<typeof sendAIMessageSchema>;

/** POST /api/ai/plan: what the member wants to make, and optionally the craft (a skill id). */
export const planRequestSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Tell me what you'd like to make.")
    .max(AI_TEXT_MAX_LENGTH, `Keep it to ${AI_TEXT_MAX_LENGTH} characters or fewer.`),
  skillId: id.optional(),
});
export type PlanRequestInput = z.output<typeof planRequestSchema>;

/** What the model must return; anything else is retried once (AI_INTEGRATION §11). */
export const aiPlanSchema = z.object({
  title: z.string().trim().min(1).max(80),
  craft: z.string().trim().min(1).max(60),
  materials: z.array(z.string().trim().min(1).max(120)).min(1).max(20),
  steps: z.array(z.string().trim().min(1).max(300)).min(1).max(15),
});

export const aiConversationParamsSchema = z.object({ id });
export const aiMessageParamsSchema = z.object({ id });

export const aiListQuerySchema = z.object({ cursor: z.string().max(500).optional() });
export type AIListQuery = z.output<typeof aiListQuerySchema>;

export const aiFeedbackSchema = z.object({
  helpful: z.boolean(),
  comment: z.string().trim().max(AI_FEEDBACK_COMMENT_MAX_LENGTH).optional(),
});
export type AIFeedbackInput = z.output<typeof aiFeedbackSchema>;

/** PUT /api/me/consents: the types given are granted or withdrawn; the rest stay as they are. */
export const consentsSchema = z
  .object({ AI_IMAGES: z.boolean(), AI_PROFILE_CONTEXT: z.boolean() })
  .partial();
export type ConsentsInput = z.output<typeof consentsSchema>;

const day = z.iso.date();

/** GET /api/admin/ai/usage: UTC days, both inclusive; the last 30 days when left out. */
export const aiUsageQuerySchema = z.object({ from: day.optional(), to: day.optional() });
export type AIUsageQuery = z.output<typeof aiUsageQuerySchema>;

/** PUT /api/admin/ai/switch. */
export const aiSwitchSchema = z.object({ enabled: z.boolean() });
export type AISwitchInput = z.output<typeof aiSwitchSchema>;
