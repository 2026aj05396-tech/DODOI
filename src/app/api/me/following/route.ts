import { followListQuerySchema } from "@/lib/schemas/follows";
import { ok, withRouteHandler } from "@/server/lib/route-handler";
import { listOwnFollowing } from "@/server/modules/follows";

/** GET /api/me/following?cursor= — the people you follow (owner only, FLW-03). */
export const GET = withRouteHandler(
  { auth: "user", query: followListQuerySchema },
  async ({ actor, query }) => ok(await listOwnFollowing(actor, query)),
);
