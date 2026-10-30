import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { MessageSettingsForm } from "@/components/settings/message-settings-form";
import { SettingsFrame } from "@/components/settings/settings-frame";
import { Skeleton } from "@/components/ui/skeleton";
import { getActor } from "@/server/auth";
import { getMessageSettings } from "@/server/modules/users";

export const metadata: Metadata = {
  title: "Messages · dodoi",
  robots: { index: false, follow: false },
};

// Settings → Messages (MSG-02, F-29 step 4; not designed, built from the system).
export default function MessageSettingsPage() {
  return (
    <SettingsFrame title="Messages">
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-card" />}>
        <MessageSettingsContent />
      </Suspense>
    </SettingsFrame>
  );
}

async function MessageSettingsContent() {
  const actor = await getActor();
  if (!actor) redirect("/sign-in?returnTo=%2Fsettings%2Fmessages");
  const settings = await getMessageSettings(actor);
  return <MessageSettingsForm initial={settings.messagePolicy} />;
}
