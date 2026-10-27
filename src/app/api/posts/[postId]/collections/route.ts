import { postIdParamsSchema } from "@/lib/schemas/posts";
import { ok, withRouteHandler } from "@/server/lib/route-handler";
import { getCollectionIdsForPost } from "@/server/modules/collections";

/** GET /api/posts/{postId}/collections — `{ ids }` of own collections holding the post (picker). */
export const GET = withRouteHandler(
  { auth: "user", params: postIdParamsSchema },
  async ({ actor, params }) => ok({ ids: await getCollectionIdsForPost(actor, params.postId) }),
);
