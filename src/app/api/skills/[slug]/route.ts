import { skillSlugParamsSchema } from "@/lib/schemas/skills";
import { ok, withRouteHandler } from "@/server/lib/route-handler";
import { getSkillBySlug } from "@/server/modules/skills";

/** GET /api/skills/{slug} — skill detail with related skills; hidden skills are 404 (API §4). */
export const GET = withRouteHandler(
  { auth: "user", params: skillSlugParamsSchema },
  async ({ actor, params }) => ok(await getSkillBySlug(actor, params.slug)),
);
