import { postIdParamsSchema } from "@/lib/schemas/posts";
import { ok, withRouteHandler } from "@/server/lib/route-handler";
import { getRelatedPosts } from "@/server/modules/content";

/** GET /api/posts/{postId}/related — up to 12 `PostCard`s sharing skills; public (OD-29). */
export const GET = withRouteHandler(
  { auth: "public", params: postIdParamsSchema },
  async ({ actor, params }) => ok({ items: await getRelatedPosts(actor, params.postId) }),
);
