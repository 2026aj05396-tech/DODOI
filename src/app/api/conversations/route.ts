import { conversationListQuerySchema, startConversationSchema } from "@/lib/schemas/messages";
import { ok, withRouteHandler } from "@/server/lib/route-handler";
import { listConversations, startConversation } from "@/server/modules/messages";

/** GET /api/conversations?cursor= — your conversations, newest activity first, with unread flags. */
export const GET = withRouteHandler(
  { auth: "user", query: conversationListQuerySchema },
  async ({ actor, query }) => ok(await listConversations(actor, query)),
);

/**
 * POST /api/conversations — `{ username }` → 200 with the existing conversation or 201 with a new
 * one: `{ id, created }`. 403 EMAIL_NOT_VERIFIED, MESSAGES_CLOSED · 404 (unknown or blocked) ·
 * 422 SELF_MESSAGE · 429 at 5 new a day.
 */
export const POST = withRouteHandler(
  { auth: "user", body: startConversationSchema },
  async ({ actor, body }) => {
    const started = await startConversation(actor, body);
    return Response.json(started, { status: started.created ? 201 : 200 });
  },
);
