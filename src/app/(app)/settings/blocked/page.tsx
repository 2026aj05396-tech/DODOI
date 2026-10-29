import type { Metadata } from "next";

import { BlockedList } from "@/components/settings/blocked-list";
import { SettingsFrame } from "@/components/settings/settings-frame";

export const metadata: Metadata = {
  title: "Blocked accounts · dodoi",
};

// Blocked accounts (P2-08, MOD-02): signed-out visitors are sent to sign-in by the proxy.
export default function BlockedSettingsPage() {
  return (
    <SettingsFrame title="Blocked accounts" description="People you blocked can't see you either.">
      <BlockedList />
    </SettingsFrame>
  );
}
