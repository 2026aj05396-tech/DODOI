import { createReportSchema } from "@/lib/schemas/reports";
import { created, withRouteHandler } from "@/server/lib/route-handler";
import { createReport } from "@/server/modules/reports";

/**
 * POST /api/reports — `{ targetType: SKILL|PROFILE, targetId (skill id or username), reason, note? }`
 * → 201 (also when the same open report exists). 403 EMAIL_NOT_VERIFIED · 422 SELF_REPORT · 429.
 */
export const POST = withRouteHandler(
  { auth: "user", body: createReportSchema },
  async ({ actor, body }) => {
    await createReport(actor, body);
    return created({ reported: true });
  },
);
