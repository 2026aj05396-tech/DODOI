import { adminIdParamsSchema } from "@/lib/schemas/admin";
import { reportActionSchema } from "@/lib/schemas/reports";
import { noContent, withRouteHandler } from "@/server/lib/route-handler";
import { actOnReport } from "@/server/modules/reports";

/**
 * POST /api/admin/reports/{id}/action — `{ action: HIDE_TARGET | DISMISS | RESTORE_TARGET }` for the
 * report's target (all its open reports). Audited. Admin only (404).
 */
export const POST = withRouteHandler(
  { auth: "public", params: adminIdParamsSchema, body: reportActionSchema },
  async ({ actor, params, body }) => {
    await actOnReport(actor, params.id, body);
    return noContent();
  },
);
