import "server-only";

import {
  MIN_ONBOARDING_INTERESTS,
  ONBOARDING_STEPS,
  type OnboardingStepInput,
} from "@/lib/schemas/me";
import type { OnboardingState } from "@/lib/types/me";
import type { Actor } from "@/server/lib/actor";
import { UnauthenticatedError, UnprocessableError } from "@/server/lib/errors";

import { findOnboardingRow, markOnboardingComplete, updateOnboardingStep } from "./repository";
import { countMyInterests } from "./user-skills";

// Onboarding progress (F-05, DC-18): 1 interests (at least 3) → 2 familiarity → 3 can-help-with.
// The current step is stored so a returning user resumes exactly where they left off.

function requireActorId(actor: Actor): string {
  if (!actor) throw new UnauthenticatedError();
  return actor.id;
}

function notEnoughInterests(): UnprocessableError {
  return new UnprocessableError(
    `Pick at least ${MIN_ONBOARDING_INTERESTS} interests to continue.`,
    { code: "NOT_ENOUGH_INTERESTS" },
  );
}

export async function getOnboardingState(actor: Actor): Promise<OnboardingState> {
  const userId = requireActorId(actor);
  const row = await findOnboardingRow(userId);
  if (!row) throw new UnauthenticatedError();
  return {
    step: row.onboardingStep,
    completed: row.onboardingCompletedAt !== null,
    interestCount: await countMyInterests(userId),
  };
}

/** Saves the step to resume at. Steps 2 and 3 need the 3 interests from step 1 first. */
export async function setOnboardingStep(
  actor: Actor,
  input: OnboardingStepInput,
): Promise<OnboardingState> {
  const userId = requireActorId(actor);
  if (input.step > 1 && (await countMyInterests(userId)) < MIN_ONBOARDING_INTERESTS) {
    throw notEnoughInterests();
  }
  await updateOnboardingStep(userId, input.step);
  return getOnboardingState(actor);
}

/** Finishes onboarding (POST /api/me/onboarding/complete). Needs at least 3 interests (OD-14). */
export async function completeOnboarding(actor: Actor): Promise<void> {
  const userId = requireActorId(actor);
  if ((await countMyInterests(userId)) < MIN_ONBOARDING_INTERESTS) throw notEnoughInterests();
  await markOnboardingComplete(userId, ONBOARDING_STEPS);
}
