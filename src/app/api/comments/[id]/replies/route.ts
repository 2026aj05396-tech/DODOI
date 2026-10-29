import { commentIdParamsSchema, commentPageQuerySchema } from "@/lib/schemas/comments";
import { ok, withRouteHandler } from "@/server/lib/route-handler";
import { listReplies } from "@/server/modules/comments";

/** GET /api/comments/{id}/replies?cursor= — replies under one comment, oldest first. */
export const GET = withRouteHandler(
  { auth: "user", params: commentIdParamsSchema, query: commentPageQuerySchema },
  async ({ actor, params, query }) => ok(await listReplies(actor, params.id, query)),
);
