import { noContent, withRouteHandler } from "@/server/lib/route-handler";
import { completeOnboarding } from "@/server/modules/users";

/** POST /api/me/onboarding/complete — 204 · 422 NOT_ENOUGH_INTERESTS (< 3 interests, OD-14). */
export const POST = withRouteHandler({ auth: "user" }, async ({ actor }) => {
  await completeOnboarding(actor);
  return noContent();
});
