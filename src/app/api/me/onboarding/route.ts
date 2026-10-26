import { onboardingStepSchema } from "@/lib/schemas/me";
import { ok, withRouteHandler } from "@/server/lib/route-handler";
import { getOnboardingState, setOnboardingStep } from "@/server/modules/users";

// Onboarding progress (P1-10): where to resume, and saving the current step.

/** GET /api/me/onboarding — `{ step, completed, interestCount }`. */
export const GET = withRouteHandler({ auth: "user" }, async ({ actor }) =>
  ok(await getOnboardingState(actor)),
);

/** PUT /api/me/onboarding — `{ step }`; 422 NOT_ENOUGH_INTERESTS before step 1 is done. */
export const PUT = withRouteHandler(
  { auth: "user", body: onboardingStepSchema },
  async ({ actor, body }) => ok(await setOnboardingStep(actor, body)),
);
