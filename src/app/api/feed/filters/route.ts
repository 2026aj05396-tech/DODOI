import { ok, withRouteHandler } from "@/server/lib/route-handler";
import { getFeedFilters } from "@/server/modules/feed";

/** GET /api/feed/filters — `{ items: [{ key, label }] }`: For you, up to 5 interests, New to you. */
export const GET = withRouteHandler({ auth: "user" }, async ({ actor }) =>
  ok({ items: await getFeedFilters(actor) }),
);
