import { communitySlugParamsSchema } from "@/lib/schemas/communities";
import { ok, withRouteHandler } from "@/server/lib/route-handler";
import { getCommunityManageView } from "@/server/modules/communities";

/** GET /api/communities/{slug}/moderation-log — the audit list with members and removed members, for the owner and moderators. */
export const GET = withRouteHandler(
  { auth: "user", params: communitySlugParamsSchema },
  async ({ actor, params }) => ok(await getCommunityManageView(actor, params.slug)),
);
