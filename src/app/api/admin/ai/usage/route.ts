import { aiUsageQuerySchema } from "@/lib/schemas/ai";
import { ok, withRouteHandler } from "@/server/lib/route-handler";
import { getUsageReport } from "@/server/modules/ai";

/**
 * GET /api/admin/ai/usage?from=&to= — requests, tokens, estimated cost, errors and blocked per UTC
 * day (dates `YYYY-MM-DD`, both inclusive, the last 30 days by default); no content. Admin only,
 * 404 for everyone else.
 */
export const GET = withRouteHandler(
  { auth: "public", query: aiUsageQuerySchema },
  async ({ actor, query }) => ok(await getUsageReport(actor, query)),
);
