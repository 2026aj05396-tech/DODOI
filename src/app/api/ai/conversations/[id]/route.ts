import { aiConversationParamsSchema } from "@/lib/schemas/ai";
import { noContent, ok, withRouteHandler } from "@/server/lib/route-handler";
import { deleteConversation, getConversation } from "@/server/modules/ai";

/** GET /api/ai/conversations/{id} — its messages, oldest first. Someone else's is a 404. */
export const GET = withRouteHandler(
  { auth: "user", params: aiConversationParamsSchema },
  async ({ actor, params }) => ok(await getConversation(actor, params.id)),
);

/** DELETE /api/ai/conversations/{id} — with its photos → 204. */
export const DELETE = withRouteHandler(
  { auth: "user", params: aiConversationParamsSchema },
  async ({ actor, params }) => {
    await deleteConversation(actor, params.id);
    return noContent();
  },
);
