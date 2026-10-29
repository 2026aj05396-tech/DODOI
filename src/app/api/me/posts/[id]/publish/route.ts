import { ownPostIdParamsSchema, publishOwnPostSchema } from "@/lib/schemas/posts";
import { ok, withRouteHandler } from "@/server/lib/route-handler";
import { publishOwnPost } from "@/server/modules/content";

/**
 * POST /api/me/posts/{id}/publish — "Share": `{ ownWorkConfirmed }` (needed the first time).
 * 400 POST_NOT_PUBLISHABLE with what is missing · 403 EMAIL_NOT_VERIFIED · 429 (20 a day).
 */
export const POST = withRouteHandler(
  { auth: "user", params: ownPostIdParamsSchema, body: publishOwnPostSchema },
  async ({ actor, params, body }) => ok(await publishOwnPost(actor, params.id, body)),
);
