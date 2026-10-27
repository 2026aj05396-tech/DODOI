import { adminReportsQuerySchema } from "@/lib/schemas/reports";
import { ok, withRouteHandler } from "@/server/lib/route-handler";
import { listReportGroups } from "@/server/modules/reports";

/** GET /api/admin/reports?status=OPEN|RESOLVED&cursor= — one group per target. Admin only (404). */
export const GET = withRouteHandler(
  { auth: "public", query: adminReportsQuerySchema },
  async ({ actor, query }) => ok(await listReportGroups(actor, query)),
);
