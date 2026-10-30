import { conversationIdParamsSchema } from "@/lib/schemas/messages";
import { noContent, ok, withRouteHandler } from "@/server/lib/route-handler";
import { getConversation, hideConversation } from "@/server/modules/messages";

/** GET /api/conversations/{id} — the other person, `canSend` and the latest messages; 404 for others. */
export const GET = withRouteHandler(
  { auth: "user", params: conversationIdParamsSchema },
  async ({ actor, params }) => ok(await getConversation(actor, params.id)),
);

/** DELETE /api/conversations/{id} — hides it for you; the other side keeps it → 204. */
export const DELETE = withRouteHandler(
  { auth: "user", params: conversationIdParamsSchema },
  async ({ actor, params }) => {
    await hideConversation(actor, params.id);
    return noContent();
  },
);
