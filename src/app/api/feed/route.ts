import { feedQuerySchema } from "@/lib/schemas/feed";
import { ok, withRouteHandler } from "@/server/lib/route-handler";
import { getFeed } from "@/server/modules/feed";

/**
 * GET /api/feed?filter=&cursor=&limit= — `{ items: FeedItem[], nextCursor }`. Without a cursor a
 * new feed session starts for the filter; 400 FEED_SESSION_EXPIRED / INVALID_FILTER.
 */
export const GET = withRouteHandler(
  { auth: "user", query: feedQuerySchema },
  async ({ actor, query }) => ok(await getFeed(actor, query)),
);
