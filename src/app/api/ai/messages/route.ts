import { sendAIMessageSchema } from "@/lib/schemas/ai";
import { created, withRouteHandler } from "@/server/lib/route-handler";
import { sendMessage } from "@/server/modules/ai";

/** Replies can take 20 s or more (measured on the free tier); the default 10 s would cut them off. */
export const maxDuration = 60;

/**
 * POST /api/ai/messages — `{ conversationId?, text, context?, imageMediaId? }` → 201 with the
 * conversation and both messages. 403 AI_CONSENT_REQUIRED · 404 · 422 AI_BLOCKED · 429 AI_QUOTA
 * (`fields.resetAt`) · 503 AI_UNAVAILABLE.
 */
export const POST = withRouteHandler(
  { auth: "user", body: sendAIMessageSchema },
  async ({ actor, body }) => created(await sendMessage(actor, body)),
);
