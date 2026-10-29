import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { ProfileView } from "@/components/profile/profile-view";
import { BackButton } from "@/components/ui/back-button";
import { Skeleton } from "@/components/ui/skeleton";
import { getActor } from "@/server/auth";
import { serverEnv } from "@/server/lib/env";
import { orNotFound } from "@/server/lib/not-found";
import { listOwnPosts, listProfilePosts } from "@/server/modules/content";
import { listProfileProjects } from "@/server/modules/journal";
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
  const [showUsernamePrompt, posts, drafts, projects] = await Promise.all([
    isOwner ? getMyProfile(actor).then((me) => me.showUsernamePrompt) : false,
    listProfilePosts(actor, username, { limit: 20 }),
    isOwner ? listOwnPosts(actor, { status: "DRAFT", limit: 12 }) : null,
    listProfileProjects(actor, username),
  ]);
  // Your own profile is a main tab; someone else's is reached from a post, search or a collection.
  return (
    <div className="flex flex-col gap-2">
      {isOwner ? null : <BackButton fallbackHref="/feed" />}
      <ProfileView
        profile={profile}
        showUsernamePrompt={showUsernamePrompt}
        supportEmail={serverEnv.SUPPORT_EMAIL ?? null}
        posts={posts}
        drafts={drafts?.items ?? []}
        projects={projects}
      />
    </div>
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
