import { postIdParamsSchema, updatePostProgressSchema } from "@/lib/schemas/posts";
import { ok, withRouteHandler } from "@/server/lib/route-handler";
import { getPostProgress, updatePostProgress } from "@/server/modules/content";

// API_SPECIFICATION §5: the signed-in user's tutorial progress on a post (POST-11/12).

/** GET /api/posts/{postId}/progress — `{ checkedMaterialIds, completedStepPositions, updatedAt }`. */
export const GET = withRouteHandler(
  { auth: "user", params: postIdParamsSchema },
  async ({ actor, params }) => ok(await getPostProgress(actor, params.postId)),
);

/** PUT /api/posts/{postId}/progress — replaces the lists given; 400 for ids not in the post. */
export const PUT = withRouteHandler(
  { auth: "user", params: postIdParamsSchema, body: updatePostProgressSchema },
  async ({ actor, params, body }) => ok(await updatePostProgress(actor, params.postId, body)),
);
