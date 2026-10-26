import { adminIdParamsSchema, updateAdminSkillSchema } from "@/lib/schemas/admin";
import { ok, withRouteHandler } from "@/server/lib/route-handler";
import { getAdminSkill, updateAdminSkill } from "@/server/modules/skills";

/** GET /api/admin/skills/{id}. Admin only (404). */
export const GET = withRouteHandler(
  { auth: "public", params: adminIdParamsSchema },
  async ({ actor, params }) => ok(await getAdminSkill(actor, params.id)),
);

/** PATCH /api/admin/skills/{id} — description, hint, pitch, cover, status (hide any skill). */
export const PATCH = withRouteHandler(
  { auth: "public", params: adminIdParamsSchema, body: updateAdminSkillSchema },
  async ({ actor, params, body }) => ok(await updateAdminSkill(actor, params.id, body)),
);
