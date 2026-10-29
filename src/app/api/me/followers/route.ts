import { followListQuerySchema } from "@/lib/schemas/follows";
import { ok, withRouteHandler } from "@/server/lib/route-handler";
import { listOwnFollowers } from "@/server/modules/follows";

/** GET /api/me/followers?cursor= — the people who follow you (owner only, FLW-03). */
export const GET = withRouteHandler(
  { auth: "user", query: followListQuerySchema },
  async ({ actor, query }) => ok(await listOwnFollowers(actor, query)),
);
