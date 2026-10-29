import { followUsernameParamsSchema } from "@/lib/schemas/follows";
import { noContent, withRouteHandler } from "@/server/lib/route-handler";
import { followUser, unfollowUser } from "@/server/modules/follows";

/** PUT /api/follows/{username} — follow (idempotent) → 204. 404 for yourself, private or hidden profiles. */
export const PUT = withRouteHandler(
  { auth: "user", params: followUsernameParamsSchema },
  async ({ actor, params }) => {
    await followUser(actor, params.username);
    return noContent();
  },
);

/** DELETE /api/follows/{username} — unfollow (idempotent) → 204. */
export const DELETE = withRouteHandler(
  { auth: "user", params: followUsernameParamsSchema },
  async ({ actor, params }) => {
    await unfollowUser(actor, params.username);
    return noContent();
  },
);
