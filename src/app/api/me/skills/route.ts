import { replaceUserSkillsSchema } from "@/lib/schemas/me";
import { ok, withRouteHandler } from "@/server/lib/route-handler";
import { getMySkills, replaceMySkills } from "@/server/modules/users";

// API_SPECIFICATION §4: the signed-in user's skills.

/** GET /api/me/skills — `{ items: [{ skill, isInterest, canHelp, wantsToLearn, level }] }`. */
export const GET = withRouteHandler({ auth: "user" }, async ({ actor }) =>
  ok(await getMySkills(actor)),
);

/** PUT /api/me/skills — replace the whole set (≤ 50); 400 SKILL_NOT_AVAILABLE for hidden skills. */
export const PUT = withRouteHandler(
  { auth: "user", body: replaceUserSkillsSchema },
  async ({ actor, body }) => ok(await replaceMySkills(actor, body)),
);
