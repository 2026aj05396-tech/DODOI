import { listPageQuerySchema } from "@/lib/schemas/collections";
import { ok, withRouteHandler } from "@/server/lib/route-handler";
import { listSavedPosts } from "@/server/modules/library";

/** GET /api/saves — "All saved": `{ items: PostCard[], nextCursor }`, most recently saved first. */
export const GET = withRouteHandler(
  { auth: "user", query: listPageQuerySchema },
  async ({ actor, query }) => ok(await listSavedPosts(actor, query)),
);
