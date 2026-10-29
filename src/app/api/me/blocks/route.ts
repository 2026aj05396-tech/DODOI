import { blockListQuerySchema } from "@/lib/schemas/blocks";
import { ok, withRouteHandler } from "@/server/lib/route-handler";
import { listBlocks } from "@/server/modules/blocks";

/** GET /api/me/blocks?cursor= — the people you blocked, newest first. */
export const GET = withRouteHandler(
  { auth: "user", query: blockListQuerySchema },
  async ({ actor, query }) => ok(await listBlocks(actor, query)),
);
