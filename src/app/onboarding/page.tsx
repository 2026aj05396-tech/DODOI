import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { OnboardingDone } from "@/components/onboarding/onboarding-done";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { Skeleton } from "@/components/ui/skeleton";
import { MIN_ONBOARDING_INTERESTS } from "@/lib/schemas/me";
import { getActor } from "@/server/auth";
import { listPredefinedSkills } from "@/server/modules/skills";
import { getMySkills, getOnboardingState } from "@/server/modules/users";

export const metadata: Metadata = {
  title: "Getting started · dodoi",
};

/** Finishing onboarding opens the home feed (F-05). */
const FINISH_PATH = "/feed";

// Onboarding (P1-11). Full screen, outside the app shell: no navigation until it is done.
export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-3xl p-10">
          <Skeleton className="h-96 w-full rounded-md" />
        </div>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}

async function OnboardingContent() {
  const actor = await getActor();
  if (!actor) redirect("/sign-in?returnTo=%2Fonboarding");
  if (!actor.isAgeConfirmed) redirect("/confirm-age?returnTo=%2Fonboarding");
  // Admins skip onboarding (PO decision, P1-17).
  if (actor.role === "ADMIN") redirect("/admin");

  const state = await getOnboardingState(actor);
  if (state.completed) return <OnboardingDone finishPath={FINISH_PATH} />;

  const [catalogue, mySkills] = await Promise.all([
    listPredefinedSkills(actor),
    getMySkills(actor),
  ]);
  // Steps 2 and 3 need 3 interests; if some were hidden meanwhile, start again at step 1.
  const step = state.interestCount < MIN_ONBOARDING_INTERESTS ? 1 : state.step;

  return (
    <OnboardingFlow
      initialStep={step}
      catalogue={catalogue}
      initialItems={mySkills.items}
      canAddOwn={actor.isEmailVerified}
      finishPath={FINISH_PATH}
    />
  );
}
