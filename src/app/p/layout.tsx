import { Suspense } from "react";
import { preconnect } from "react-dom";

import { VerifyEmailBanner } from "@/components/auth/verify-email-banner";
import { AppShell } from "@/components/layout/app-shell";
import { PublicHeader } from "@/components/layout/public-header";
import { InstallBanner } from "@/components/pwa/install-banner";
import { MEDIA_ORIGIN } from "@/lib/constants/media";
import { getActor } from "@/server/auth";

// Post pages are public (OD-29), so they sit outside the signed-in (app) group and the proxy.
// Signed-in users get the app shell (full screen on mobile, `1e`); signed-out visitors get the
// slim bar with Log in / Sign up (PO decision, P1-20). Each page checks the session itself.
export default function PostLayout({ children }: LayoutProps<"/p">) {
  // Post images come from Cloudinary. React sends this as a `Link: rel=preconnect` header, so the
  // connection is open before the first image is found (P1-31).
  preconnect(MEDIA_ORIGIN);
  return (
    <Suspense fallback={<div className="min-h-dvh" />}>
      <PostFrame>{children}</PostFrame>
    </Suspense>
  );
}

async function PostFrame({ children }: { children: React.ReactNode }) {
  const actor = await getActor();
  if (!actor) {
    return (
      <div className="flex min-h-dvh flex-col">
        <PublicHeader />
        <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
          {children}
        </main>
      </div>
    );
  }
  return (
    <AppShell
      username={null}
      fullScreenOnMobile
      notice={
        <>
          {actor.isEmailVerified ? null : <VerifyEmailBanner />}
          <InstallBanner />
        </>
      }
    >
      {children}
    </AppShell>
  );
}
