import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthPage } from "@/components/auth/auth-page";
import { ConfirmAgeForm } from "@/components/auth/confirm-age-form";
import { toSafeReturnPath } from "@/lib/utils/safe-return-path";
import { firstSearchParam } from "@/lib/utils/search-params";
import { getActor } from "@/server/auth";

export const metadata: Metadata = {
  title: "Your date of birth · dodoi",
};

// Date-of-birth step after a first Google sign-in (AUTH-11). Every Google sign-in passes through
// here; accounts that already confirmed their age go straight on to `returnTo`.
export default function ConfirmAgePage({ searchParams }: PageProps<"/confirm-age">) {
  return (
    <AuthPage title="One last thing">
      <ConfirmAgeContent searchParams={searchParams} />
    </AuthPage>
  );
}

async function ConfirmAgeContent({
  searchParams,
}: Pick<PageProps<"/confirm-age">, "searchParams">) {
  const returnTo = toSafeReturnPath(firstSearchParam((await searchParams).returnTo));
  const actor = await getActor();
  if (!actor) {
    const thisPage = `/confirm-age?returnTo=${encodeURIComponent(returnTo)}`;
    redirect(`/sign-in?returnTo=${encodeURIComponent(thisPage)}`);
  }
  if (actor.isAgeConfirmed) redirect(returnTo);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-body text-foreground-secondary">
        What&apos;s your date of birth? dodoi is for adults 18 and over.
      </p>
      <ConfirmAgeForm returnTo={returnTo} />
    </div>
  );
}
