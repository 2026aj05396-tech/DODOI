import { adminIdParamsSchema, setRelatedSkillsSchema } from "@/lib/schemas/admin";
import { ok, withRouteHandler } from "@/server/lib/route-handler";
import { setRelatedSkills } from "@/server/modules/skills";

/** PUT /api/admin/skills/{id}/related — replaces related skills (stored in both directions). */
export const PUT = withRouteHandler(
  { auth: "public", params: adminIdParamsSchema, body: setRelatedSkillsSchema },
  async ({ actor, params, body }) => ok(await setRelatedSkills(actor, params.id, body)),
);
