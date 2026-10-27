import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { ChangePasswordForm } from "@/components/settings/change-password-form";
import { SettingsFrame } from "@/components/settings/settings-frame";
import { ComingSoonCard } from "@/components/ui/coming-soon";
import { Skeleton } from "@/components/ui/skeleton";
import { getActor } from "@/server/auth";
import { getMyProfile } from "@/server/modules/library";

export const metadata: Metadata = {
  title: "Account · dodoi",
};

// Account settings (P1-14): email (read only), password, sign out. Account deletion arrives with
// P1-28, so it is "coming soon" here.
export default function AccountSettingsPage() {
  return (
    <SettingsFrame title="Account">
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-card" />}>
        <AccountContent />
      </Suspense>
    </SettingsFrame>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-border pt-5 first:border-t-0 first:pt-0">
      <h2 className="text-section text-foreground">{title}</h2>
      {children}
    </section>
  );
}

async function AccountContent() {
  const actor = await getActor();
  if (!actor) redirect("/sign-in?returnTo=%2Fsettings%2Faccount");
  const profile = await getMyProfile(actor);
  return (
    <div className="flex flex-col gap-6">
      <Section title="Email">
        <p className="text-body-lg break-all text-foreground">{profile.email}</p>
        {!actor.isEmailVerified ? (
          <p className="text-meta text-foreground-secondary">
            Not verified yet. Check your inbox for the link we sent.
          </p>
        ) : null}
      </Section>
      <Section title="Password">
        {profile.hasPassword ? (
          <ChangePasswordForm />
        ) : (
          <p className="text-body text-foreground">
            You sign in with Google. To also sign in with a password,{" "}
            <Link href="/forgot-password" className="font-bold text-link hover:underline">
              set one by email
            </Link>
            .
          </p>
        )}
      </Section>
      <Section title="Sign out">
        <p className="text-body text-foreground-secondary">Sign out of dodoi on this device.</p>
        <div>
          <SignOutButton />
        </div>
      </Section>
      <Section title="Delete account">
        <ComingSoonCard
          title="Delete your account"
          description="You'll be able to delete your account and everything in it from here."
        />
      </Section>
    </div>
  );
}
