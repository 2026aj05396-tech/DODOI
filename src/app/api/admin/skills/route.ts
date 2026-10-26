import { ok, withRouteHandler } from "@/server/lib/route-handler";
import { listAdminSkills } from "@/server/modules/skills";

/** GET /api/admin/skills — every skill, hidden ones included, alphabetically. Admin only (404). */
export const GET = withRouteHandler({ auth: "public" }, async ({ actor }) =>
  ok({ items: await listAdminSkills(actor) }),
);
