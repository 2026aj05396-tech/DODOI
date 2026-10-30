import { communityModerationSchema, communitySlugParamsSchema } from "@/lib/schemas/communities";
import { noContent, withRouteHandler } from "@/server/lib/route-handler";
import { moderateCommunity } from "@/server/modules/communities";

/**
 * POST /api/communities/{slug}/moderation — `{ action, targetId, role? }` by the owner or a
 * moderator → 204, logged without content. 403 NOT_MANAGER, NOT_OWNER · 422 INVALID_TARGET.
 */
export const POST = withRouteHandler(
  { auth: "user", params: communitySlugParamsSchema, body: communityModerationSchema },
  async ({ actor, params, body }) => {
    await moderateCommunity(actor, params.slug, body);
    return noContent();
  },
);
