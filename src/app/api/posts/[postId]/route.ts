import { postIdParamsSchema } from "@/lib/schemas/posts";
import { ok, withRouteHandler } from "@/server/lib/route-handler";
import { getPostDetail } from "@/server/modules/content";

/**
 * GET /api/posts/{postId} — `PostDetail`. Public for published posts so shared links work
 * (OD-29); drafts and unpublished posts are 404 except for admins.
 */
export const GET = withRouteHandler(
  { auth: "public", params: postIdParamsSchema },
  async ({ actor, params }) => ok(await getPostDetail(actor, params.postId)),
);
