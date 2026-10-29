import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { NotificationPreferencesForm } from "@/components/settings/notification-preferences-form";
import { SettingsFrame } from "@/components/settings/settings-frame";
import { Skeleton } from "@/components/ui/skeleton";
import { getActor } from "@/server/auth";
import { getNotificationPreferences } from "@/server/modules/notifications";

export const metadata: Metadata = {
  title: "Notifications · dodoi",
};

export default function NotificationSettingsPage() {
  return (
    <SettingsFrame title="Notifications" description="Choose what you hear about in the app.">
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-card" />}>
        <NotificationSettingsContent />
      </Suspense>
    </SettingsFrame>
  );
}

async function NotificationSettingsContent() {
  const actor = await getActor();
  if (!actor) redirect("/sign-in?returnTo=%2Fsettings%2Fnotifications");
  return <NotificationPreferencesForm initial={await getNotificationPreferences(actor)} />;
}
