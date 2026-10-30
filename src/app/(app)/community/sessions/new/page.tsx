import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { ProposeSessionForm } from "@/components/sessions/propose-session-form";
import { BackButton } from "@/components/ui/back-button";
import { Skeleton } from "@/components/ui/skeleton";
import { getActor } from "@/server/auth";
import { orNotFound } from "@/server/lib/not-found";
import { getProfile } from "@/server/modules/library";

export const metadata: Metadata = {
  title: "Propose a session · dodoi",
  robots: { index: false, follow: false },
};

type SearchParams = PageProps<"/community/sessions/new">["searchParams"];

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

// Propose a session (SES-01, F-30 step 1). `?with=` is the person, `?request=` the help request it
// follows from.
export default function NewSessionPage({ searchParams }: PageProps<"/community/sessions/new">) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-5 pt-4 pb-10 md:px-7 md:pt-8">
      <div className="flex flex-col gap-2">
        <BackButton fallbackHref="/community/sessions" />
        <h1 className="text-greeting text-foreground md:text-greeting-web">Propose a session</h1>
        <p className="text-body text-foreground-secondary">
          A short call on your own meeting link. They can accept, decline or suggest another time.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-card" />}>
        <FormContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function FormContent({ searchParams }: { searchParams: SearchParams }) {
  const actor = await getActor();
  const query = await searchParams;
  const username = first(query.with).trim().toLowerCase();
  if (!actor) {
    redirect(`/sign-in?returnTo=${encodeURIComponent(`/community/sessions/new?with=${username}`)}`);
  }
  if (!username) redirect("/community/sessions");
  const profile = await orNotFound(getProfile(actor, username));
  if (profile.isPrivate ? false : profile.isOwner) redirect("/community/sessions");
  const helpRequestId = first(query.request).trim();
  return (
    <>
      <p className="text-body text-foreground">
        With <span className="font-bold">{profile.displayName}</span>{" "}
        <span className="text-foreground-secondary">@{profile.username}</span>
      </p>
      <ProposeSessionForm
        invitee={{ username: profile.username, displayName: profile.displayName }}
        {...(helpRequestId ? { helpRequestId } : {})}
        isVerified={actor.isEmailVerified}
      />
    </>
  );
}
