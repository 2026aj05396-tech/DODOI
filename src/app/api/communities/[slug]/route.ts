import { communitySlugParamsSchema } from "@/lib/schemas/communities";
import { noContent, ok, withRouteHandler } from "@/server/lib/route-handler";
import { deleteCommunity, getCommunityBySlug } from "@/server/modules/communities";

/** GET /api/communities/{slug} — details, rules and `myRole`; 404 when hidden or unknown. */
export const GET = withRouteHandler(
  { auth: "user", params: communitySlugParamsSchema },
  async ({ actor, params }) => ok(await getCommunityBySlug(actor, params.slug)),
);

/** DELETE /api/communities/{slug} — only the owner; discussions and photos go with it → 204. */
export const DELETE = withRouteHandler(
  { auth: "user", params: communitySlugParamsSchema },
  async ({ actor, params }) => {
    await deleteCommunity(actor, params.slug);
    return noContent();
  },
);
