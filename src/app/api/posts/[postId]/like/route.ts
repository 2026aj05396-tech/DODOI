import { postIdParamsSchema } from "@/lib/schemas/posts";
import { noContent, withRouteHandler } from "@/server/lib/route-handler";
import { likePost, unlikePost } from "@/server/modules/likes";

/** PUT /api/posts/{postId}/like — like (idempotent) → 204. 403 EMAIL_NOT_VERIFIED. */
export const PUT = withRouteHandler(
  { auth: "user", params: postIdParamsSchema },
  async ({ actor, params }) => {
    await likePost(actor, params.postId);
    return noContent();
  },
);

/** DELETE /api/posts/{postId}/like — unlike (idempotent) → 204. */
export const DELETE = withRouteHandler(
  { auth: "user", params: postIdParamsSchema },
  async ({ actor, params }) => {
    await unlikePost(actor, params.postId);
    return noContent();
  },
);
