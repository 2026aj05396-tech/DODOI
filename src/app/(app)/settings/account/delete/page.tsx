import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { DeleteAccountForm } from "@/components/settings/delete-account-form";
import { SettingsFrame } from "@/components/settings/settings-frame";
import { Skeleton } from "@/components/ui/skeleton";
import { formatLongDate } from "@/lib/utils/dates";
import { getActor } from "@/server/auth";
import { getMyProfile } from "@/server/modules/library";
import { deletionDateFor, isRecentSignIn } from "@/server/modules/users";

export const metadata: Metadata = {
  title: "Delete account · dodoi",
};

// Delete account (F-14, P1-28; not designed, built from the system): what happens, then the
// confirmation (password, or signing in with Google again).
export default function DeleteAccountPage() {
  return (
    <SettingsFrame title="Delete account" backHref="/settings/account">
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-card" />}>
        <DeleteAccountContent />
      </Suspense>
    </SettingsFrame>
  );
}

async function DeleteAccountContent() {
  const actor = await getActor();
  if (!actor) redirect("/sign-in?returnTo=%2Fsettings%2Faccount%2Fdelete");
  if (actor.role === "ADMIN") {
    return (
      <p className="text-body text-foreground">
        Admin accounts can&apos;t be deleted from settings.
      </p>
    );
  }
  const profile = await getMyProfile(actor);
  const date = formatLongDate(deletionDateFor(new Date()));

  return (
    <DeleteAccountForm
      hasPassword={profile.hasPassword}
      isRecentSignIn={isRecentSignIn(actor.signedInAt)}
      explanation={
        <section className="flex flex-col gap-3">
          <h2 className="text-section text-foreground">What happens</h2>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-body text-foreground">
            <li>You&apos;re signed out everywhere and your profile is hidden straight away.</li>
            <li>
              On {date} we delete your profile, skills, saves, collections and tutorial progress for
              good.
            </li>
            <li>Custom skills you added stay on dodoi, without your name.</li>
            <li>Changed your mind? Sign in before {date} to cancel.</li>
          </ul>
        </section>
      }
    />
  );
}
