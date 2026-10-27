import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { ProfileView } from "@/components/profile/profile-view";
import { Skeleton } from "@/components/ui/skeleton";
import { getActor } from "@/server/auth";
import { serverEnv } from "@/server/lib/env";
import { orNotFound } from "@/server/lib/not-found";
import { getMyProfile, getProfile } from "@/server/modules/library";

export const metadata: Metadata = {
  title: "Profile · dodoi",
};

type Params = PageProps<"/u/[username]">["params"];

// Public profile (P1-14, PRF-05…08). Signed-in users only (OD-29).
export default function ProfilePage({ params }: PageProps<"/u/[username]">) {
  return (
    <div className="mx-auto max-w-4xl px-5 pt-4 pb-10 md:px-7 md:pt-8 xl:px-10">
      <Suspense fallback={<ProfileSkeleton />}>
        <ProfileContent params={params} />
      </Suspense>
    </div>
  );
}

async function ProfileContent({ params }: { params: Params }) {
  const actor = await getActor();
  const { username } = await params;
  if (!actor) redirect(`/sign-in?returnTo=${encodeURIComponent(`/u/${username}`)}`);
  const profile = await orNotFound(getProfile(actor, username));
  const isOwner = !profile.isPrivate && profile.isOwner;
  const showUsernamePrompt = isOwner ? (await getMyProfile(actor)).showUsernamePrompt : false;
  return (
    <ProfileView
      profile={profile}
      showUsernamePrompt={showUsernamePrompt}
      supportEmail={serverEnv.SUPPORT_EMAIL ?? null}
    />
  );
}

function ProfileSkeleton() {
  return (
    <div role="status" aria-label="Loading the profile" className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Skeleton className="size-22 rounded-full md:size-28" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-8 w-48 rounded-md" />
          <Skeleton className="h-5 w-32 rounded-md" />
        </div>
      </div>
      <Skeleton className="h-24 w-full rounded-card" />
      <Skeleton className="h-40 w-full rounded-card" />
    </div>
  );
}
