import { searchQuerySchema } from "@/lib/schemas/search";
import { ok, withRouteHandler } from "@/server/lib/route-handler";
import { search } from "@/server/modules/search";

/**
 * GET /api/search?q=&type=all|posts|skills|creators&cursor=&limit= — `type=all`: up to 8 of each;
 * otherwise `{ items, nextCursor }`. 60 per minute per user (429).
 */
export const GET = withRouteHandler(
  { auth: "user", query: searchQuerySchema },
  async ({ actor, query }) => ok(await search(actor, query)),
);
