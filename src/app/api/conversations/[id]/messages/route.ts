import {
  conversationIdParamsSchema,
  messagesQuerySchema,
  sendMessageSchema,
} from "@/lib/schemas/messages";
import { created, ok, withRouteHandler } from "@/server/lib/route-handler";
import { listMessages, sendMessage } from "@/server/modules/messages";

/** GET /api/conversations/{id}/messages?after=|before= — oldest first; `after` is the polling call. */
export const GET = withRouteHandler(
  { auth: "user", params: conversationIdParamsSchema, query: messagesQuerySchema },
  async ({ actor, params, query }) => ok(await listMessages(actor, params.id, query)),
);

/**
 * POST /api/conversations/{id}/messages — `{ body }` → 201 with the message. 403 MESSAGES_CLOSED,
 * EMAIL_NOT_VERIFIED · 422 AWAITING_REPLY after 3 unanswered · 429 at 30 an hour.
 */
export const POST = withRouteHandler(
  { auth: "user", params: conversationIdParamsSchema, body: sendMessageSchema },
  async ({ actor, params, body }) => created(await sendMessage(actor, params.id, body)),
);
