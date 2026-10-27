import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { SettingsFrame } from "@/components/settings/settings-frame";
import { SkillsEditor } from "@/components/settings/skills-editor";
import { Skeleton } from "@/components/ui/skeleton";
import { getActor } from "@/server/auth";
import { listPredefinedSkills } from "@/server/modules/skills";
import { getMySkills } from "@/server/modules/users";

export const metadata: Metadata = {
  title: "Your skills · dodoi",
};

export default function SkillsSettingsPage() {
  return (
    <SettingsFrame
      title="Your skills"
      description="Shown on your profile. Your interests also shape your feed."
    >
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-card" />}>
        <SkillsContent />
      </Suspense>
    </SettingsFrame>
  );
}

async function SkillsContent() {
  const actor = await getActor();
  if (!actor) redirect("/sign-in?returnTo=%2Fsettings%2Fskills");
  const [catalogue, mine] = await Promise.all([listPredefinedSkills(actor), getMySkills(actor)]);
  return (
    <SkillsEditor
      catalogue={catalogue}
      initialItems={mine.items}
      canAddOwn={actor.isEmailVerified}
    />
  );
}
