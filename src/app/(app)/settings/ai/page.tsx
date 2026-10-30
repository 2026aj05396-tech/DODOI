import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AiPrivacyForm } from "@/components/settings/ai-privacy-form";
import { SettingsFrame } from "@/components/settings/settings-frame";
import { Skeleton } from "@/components/ui/skeleton";
import { getActor } from "@/server/auth";
import { getCompanionSetup, listConversations } from "@/server/modules/ai";

export const metadata: Metadata = {
  title: "AI and privacy · dodoi",
  robots: { index: false, follow: false },
};

// Settings → AI and privacy (P4-07, F-26; not designed, built from the system).
export default function AiPrivacySettingsPage() {
  return (
    <SettingsFrame title="AI and privacy">
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-card" />}>
        <AiPrivacyContent />
      </Suspense>
    </SettingsFrame>
  );
}

async function AiPrivacyContent() {
  const actor = await getActor();
  if (!actor) redirect("/sign-in?returnTo=%2Fsettings%2Fai");
  const [setup, chats] = await Promise.all([
    getCompanionSetup(actor),
    listConversations(actor, {}),
  ]);
  return (
    <AiPrivacyForm
      initialConsents={setup.consents}
      initialChats={chats}
      showFreeTierNotice={setup.showFreeTierNotice}
    />
  );
}
