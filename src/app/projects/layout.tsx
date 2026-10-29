import { Suspense } from "react";
import { preconnect } from "react-dom";

import { VerifyEmailBanner } from "@/components/auth/verify-email-banner";
import { AppShell } from "@/components/layout/app-shell";
import { MEDIA_ORIGIN } from "@/lib/constants/media";
import { getActor } from "@/server/auth";

// A journal project (P2-03, design `1g`): full screen on phones with its own bottom bar, like a
// post (`1e`); the usual shell from 768px. Signed-in only (src/proxy.ts and each page).
export default function ProjectLayout({ children }: LayoutProps<"/projects">) {
  preconnect(MEDIA_ORIGIN);
  return (
    <AppShell username={null} fullScreenOnMobile notice={<AccountNotice />}>
      {children}
    </AppShell>
  );
}

function AccountNotice() {
  return (
    <Suspense fallback={null}>
      <VerifyNotice />
    </Suspense>
  );
}

/** Reads the session at request time, inside its own boundary so the shell stays static. */
async function VerifyNotice() {
  const actor = await getActor();
  return actor && !actor.isEmailVerified ? <VerifyEmailBanner /> : null;
}
