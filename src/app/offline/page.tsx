import { CloudOff } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/ui/empty-state";

import { TryAgainButton } from "./try-again-button";

export const metadata: Metadata = {
  title: "Offline · dodoi",
};

// Offline fallback (P1-27, PWA-05, USER_FLOWS F-13): the service worker shows it, precached, for
// any page that isn't on this device while offline. Static, so it never needs the network. Not
// designed: built from the design system like the not-found page (DC-11).
export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center">
      <EmptyState
        icon={<CloudOff strokeWidth={1.8} />}
        title="You're offline"
        titleAs="h1"
        description="This page isn't saved on this device. Pages you've opened before, like your feed and saved posts, still open without a connection."
        action={<TryAgainButton />}
      />
    </main>
  );
}
