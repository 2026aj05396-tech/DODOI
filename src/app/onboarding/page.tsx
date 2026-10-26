import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { OnboardingDone } from "@/components/onboarding/onboarding-done";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { Skeleton } from "@/components/ui/skeleton";
import { MAX_PAGE_SIZE } from "@/lib/constants/pagination";
import { MIN_ONBOARDING_INTERESTS } from "@/lib/schemas/me";
import type { SkillSummary } from "@/lib/types/skills";
import { getActor } from "@/server/auth";
import type { AuthenticatedActor } from "@/server/lib/actor";
import { listSkills } from "@/server/modules/skills";
import { getMySkills, getOnboardingState } from "@/server/modules/users";

export const metadata: Metadata = {
  title: "Getting started · dodoi",
};

/** Until the home feed exists (P1-22), finishing returns to `/`. */
const FINISH_PATH = "/";

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

/** Every predefined skill, alphabetically (51 today, so a couple of pages at most). */
async function loadCatalogue(actor: AuthenticatedActor): Promise<SkillSummary[]> {
  const skills: SkillSummary[] = [];
  let cursor: string | undefined;
  do {
    const page = await listSkills(actor, { origin: "PREDEFINED", limit: MAX_PAGE_SIZE, cursor });
    skills.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return skills;
}

async function OnboardingContent() {
  const actor = await getActor();
  if (!actor) redirect("/sign-in?returnTo=%2Fonboarding");
  if (!actor.isAgeConfirmed) redirect("/confirm-age?returnTo=%2Fonboarding");
  // Admins skip onboarding (PO decision, P1-17).
  if (actor.role === "ADMIN") redirect("/admin");

  const state = await getOnboardingState(actor);
  if (state.completed) return <OnboardingDone finishPath={FINISH_PATH} />;

  const [catalogue, mySkills] = await Promise.all([loadCatalogue(actor), getMySkills(actor)]);
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
