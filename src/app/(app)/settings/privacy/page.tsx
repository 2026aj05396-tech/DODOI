import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { PrivacyForm } from "@/components/settings/privacy-form";
import { SettingsFrame } from "@/components/settings/settings-frame";
import { Skeleton } from "@/components/ui/skeleton";
import { getActor } from "@/server/auth";
import { getMyProfile } from "@/server/modules/library";

export const metadata: Metadata = {
  title: "Privacy · dodoi",
};

export default function PrivacySettingsPage() {
  return (
    <SettingsFrame title="Privacy">
      <Suspense fallback={<Skeleton className="h-48 w-full rounded-card" />}>
        <PrivacyContent />
      </Suspense>
    </SettingsFrame>
  );
}

async function PrivacyContent() {
  const actor = await getActor();
  if (!actor) redirect("/sign-in?returnTo=%2Fsettings%2Fprivacy");
  return <PrivacyForm initial={(await getMyProfile(actor)).visibility} />;
}
