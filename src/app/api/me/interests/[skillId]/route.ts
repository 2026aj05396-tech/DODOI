import { z } from "zod";

import { noContent, withRouteHandler } from "@/server/lib/route-handler";
import { setInterest } from "@/server/modules/users";

// One interest on or off (skill page, P1-26). The whole set is edited with PUT /api/me/skills.

const params = z.object({ skillId: z.string().min(1).max(40) });

/** PUT /api/me/interests/{skillId} — add (idempotent) → 204 · 422 TOO_MANY_SKILLS. */
export const PUT = withRouteHandler({ auth: "user", params }, async ({ actor, params: path }) => {
  await setInterest(actor, path.skillId, true);
  return noContent();
});

/** DELETE /api/me/interests/{skillId} — remove (idempotent) → 204 · 422 NOT_ENOUGH_INTERESTS. */
export const DELETE = withRouteHandler(
  { auth: "user", params },
  async ({ actor, params: path }) => {
    await setInterest(actor, path.skillId, false);
    return noContent();
  },
);
