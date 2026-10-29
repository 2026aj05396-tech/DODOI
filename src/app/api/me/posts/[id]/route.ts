import { ownPostIdParamsSchema, updateOwnPostSchema } from "@/lib/schemas/posts";
import { noContent, ok, withRouteHandler } from "@/server/lib/route-handler";
import { deleteOwnPost, getOwnPost, updateOwnPost } from "@/server/modules/content";

/** GET /api/me/posts/{id} — the full editable post; someone else's post → 404. */
export const GET = withRouteHandler(
  { auth: "user", params: ownPostIdParamsSchema },
  async ({ actor, params }) => ok(await getOwnPost(actor, params.id)),
);

/**
 * PATCH /api/me/posts/{id} — any subset; lists are replaced. A published post changes live and
 * must still meet the publish rules (400 POST_NOT_PUBLISHABLE).
 */
export const PATCH = withRouteHandler(
  { auth: "user", params: ownPostIdParamsSchema, body: updateOwnPostSchema },
  async ({ actor, params, body }) => ok(await updateOwnPost(actor, params.id, body)),
);

/** DELETE /api/me/posts/{id} — the post, its comments, likes and saves, and its media → 204. */
export const DELETE = withRouteHandler(
  { auth: "user", params: ownPostIdParamsSchema },
  async ({ actor, params }) => {
    await deleteOwnPost(actor, params.id);
    return noContent();
  },
);
