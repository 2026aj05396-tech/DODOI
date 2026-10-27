import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthPage } from "@/components/auth/auth-page";
import { CancelDeletionButton } from "@/components/auth/cancel-deletion-button";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { formatLongDate } from "@/lib/utils/dates";
import { getActor } from "@/server/auth";
import { getDeletionScheduledFor } from "@/server/modules/users";

export const metadata: Metadata = {
  title: "Account scheduled for deletion · dodoi",
};

// Shown instead of every signed-in page while the account is deactivated (SECURITY_AND_PRIVACY
// §7.3, P1-28): the only ways on are cancelling the deletion or signing out.
export default function AccountDeletionPage() {
  return (
    <AuthPage title="Your account is scheduled for deletion">
      <AccountDeletionContent />
    </AuthPage>
  );
}

async function AccountDeletionContent() {
  const actor = await getActor();
  if (!actor) redirect("/sign-in");
  const scheduledFor = await getDeletionScheduledFor(actor);
  if (!scheduledFor) redirect("/feed");

  return (
    <div className="flex flex-col gap-6">
      <p className="text-body-lg text-foreground">
        We&apos;ll delete your account and everything in it on {formatLongDate(scheduledFor)}.
        Changed your mind? Cancel the deletion to keep using dodoi.
      </p>
      <div className="flex flex-col gap-3">
        <CancelDeletionButton />
        <SignOutButton />
      </div>
    </div>
  );
}
