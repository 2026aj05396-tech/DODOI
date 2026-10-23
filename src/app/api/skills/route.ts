import { createCustomSkillInputSchema, listSkillsQuerySchema } from "@/lib/schemas/skills";
import { created, ok, withRouteHandler } from "@/server/lib/route-handler";
import { listSkills, resolveCustomSkill } from "@/server/modules/skills";

// API_SPECIFICATION §4: skills list/search and custom interests.

/** GET /api/skills — active skills, alphabetical or matching `q`. */
export const GET = withRouteHandler(
  { auth: "user", query: listSkillsQuerySchema },
  async ({ actor, query }) => ok(await listSkills(actor, query)),
);

/** POST /api/skills — create a custom interest, or return the existing skill with that name. */
export const POST = withRouteHandler(
  { auth: "user", body: createCustomSkillInputSchema },
  async ({ actor, body }) => {
    const result = await resolveCustomSkill(actor, body);
    return result.created ? created(result.skill) : ok(result.skill);
  },
);
