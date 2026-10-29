import type { Metadata } from "next";

import { NotificationList } from "@/components/notifications/notification-list";
import { BackButton } from "@/components/ui/back-button";

export const metadata: Metadata = {
  title: "Notifications · dodoi",
};

// Notifications (P2-07, NTF-02): signed-out visitors are sent to sign-in by the proxy.
export default function NotificationsPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 pt-4 pb-10 md:px-7 md:pt-8">
      <BackButton fallbackHref="/feed" />
      <h1 className="mt-2 mb-4 text-greeting text-foreground md:text-greeting-web">
        Notifications
      </h1>
      <NotificationList />
    </div>
  );
}
