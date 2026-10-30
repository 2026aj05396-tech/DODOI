import { communitySlugParamsSchema } from "@/lib/schemas/communities";
import { noContent, withRouteHandler } from "@/server/lib/route-handler";
import { joinCommunity, leaveCommunity } from "@/server/modules/communities";

/** PUT /api/communities/{slug}/membership — join → 204. 403 REMOVED after a removal. */
export const PUT = withRouteHandler(
  { auth: "user", params: communitySlugParamsSchema },
  async ({ actor, params }) => {
    await joinCommunity(actor, params.slug);
    return noContent();
  },
);

/** DELETE /api/communities/{slug}/membership — leave → 204. 422 OWNER_MUST_HAND_OVER for the owner. */
export const DELETE = withRouteHandler(
  { auth: "user", params: communitySlugParamsSchema },
  async ({ actor, params }) => {
    await leaveCommunity(actor, params.slug);
    return noContent();
  },
);
