import { communityPostIdParamsSchema, updateCommunityPostSchema } from "@/lib/schemas/communities";
import { noContent, ok, withRouteHandler } from "@/server/lib/route-handler";
import { deleteCommunityPost, updateCommunityPost } from "@/server/modules/communities";

/** PATCH /api/community-posts/{id} — `{ body }`; the author, for 15 minutes. 422 EDIT_WINDOW_CLOSED. */
export const PATCH = withRouteHandler(
  { auth: "user", params: communityPostIdParamsSchema, body: updateCommunityPostSchema },
  async ({ actor, params, body }) => ok(await updateCommunityPost(actor, params.id, body)),
);

/** DELETE /api/community-posts/{id} — the author, the owner or a moderator → 204 (replies and photos go too). */
export const DELETE = withRouteHandler(
  { auth: "user", params: communityPostIdParamsSchema },
  async ({ actor, params }) => {
    await deleteCommunityPost(actor, params.id);
    return noContent();
  },
);
