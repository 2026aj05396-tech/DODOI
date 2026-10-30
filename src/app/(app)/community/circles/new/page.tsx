import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { CreateCommunityForm } from "@/components/community/create-community-form";
import { BackButton } from "@/components/ui/back-button";
import { Skeleton } from "@/components/ui/skeleton";
import { getActor } from "@/server/auth";
import { getActivePredefinedSkills } from "@/server/modules/skills";

export const metadata: Metadata = {
  title: "Start a community · dodoi",
  robots: { index: false, follow: false },
};

// Start a community (COM-01, COM-02, F-28 step 3). Public communities only (OD-06).
export default function NewCommunityPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-5 pt-4 pb-10 md:px-7 md:pt-8">
      <div className="flex flex-col gap-2">
        <BackButton fallbackHref="/community/circles" />
        <h1 className="text-greeting text-foreground md:text-greeting-web">Start a community</h1>
        <p className="text-body text-foreground-secondary">
          A place for makers of one craft to share and help each other. You&apos;ll be its owner.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-card" />}>
        <FormContent />
      </Suspense>
    </div>
  );
}

async function FormContent() {
  const actor = await getActor();
  if (!actor) redirect("/sign-in?returnTo=%2Fcommunity%2Fcircles%2Fnew");
  const skills = await getActivePredefinedSkills();
  return (
    <CreateCommunityForm
      skills={skills.map(({ id, name }) => ({ id, name }))}
      isVerified={actor.isEmailVerified}
    />
  );
}
