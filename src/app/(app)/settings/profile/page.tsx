import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { EditProfileForm } from "@/components/settings/edit-profile-form";
import { SettingsFrame } from "@/components/settings/settings-frame";
import { Skeleton } from "@/components/ui/skeleton";
import { getActor } from "@/server/auth";
import { getMyProfile } from "@/server/modules/library";

export const metadata: Metadata = {
  title: "Edit profile · dodoi",
};

export default function EditProfilePage() {
  return (
    <SettingsFrame title="Edit profile">
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-card" />}>
        <EditProfileContent />
      </Suspense>
    </SettingsFrame>
  );
}

async function EditProfileContent() {
  const actor = await getActor();
  if (!actor) redirect("/sign-in?returnTo=%2Fsettings%2Fprofile");
  return <EditProfileForm profile={await getMyProfile(actor)} />;
}
