import { aiListQuerySchema } from "@/lib/schemas/ai";
import { noContent, ok, withRouteHandler } from "@/server/lib/route-handler";
import { deleteAllConversations, listConversations } from "@/server/modules/ai";

/** GET /api/ai/conversations?cursor= — your conversations, newest activity first. */
export const GET = withRouteHandler(
  { auth: "user", query: aiListQuerySchema },
  async ({ actor, query }) => ok(await listConversations(actor, query)),
);

/** DELETE /api/ai/conversations — deletes all of them, with their photos → 204. */
export const DELETE = withRouteHandler({ auth: "user" }, async ({ actor }) => {
  await deleteAllConversations(actor);
  return noContent();
});
