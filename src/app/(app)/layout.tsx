import { Suspense } from "react";
import { preconnect } from "react-dom";

import { VerifyEmailBanner } from "@/components/auth/verify-email-banner";
import { AppShell } from "@/components/layout/app-shell";
import { MEDIA_ORIGIN } from "@/lib/constants/media";
import { getActor } from "@/server/auth";

// Signed-in area. src/proxy.ts sends signed-out visitors to /sign-in and each page checks the
// session with getActor(). The username for the profile link is wired with the profile UI (P1-14).
export default function AppLayout({ children }: LayoutProps<"/">) {
  // Signed-in pages show Cloudinary media. React sends this as a `Link: rel=preconnect` header, so
  // the connection is open before the first image is found (P1-31).
  preconnect(MEDIA_ORIGIN);
  return (
    <AppShell
      username={null}
      notice={
        <Suspense fallback={null}>
          <AccountNotice />
        </Suspense>
      }
    >
      {children}
    </AppShell>
  );
}

/** Reads the session at request time, inside its own boundary so the shell stays static. */
async function AccountNotice() {
  const actor = await getActor();
  return actor && !actor.isEmailVerified ? <VerifyEmailBanner /> : null;
}
