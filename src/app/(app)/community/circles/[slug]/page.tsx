import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { CommunityView } from "@/components/community/community-view";
import { BackButton } from "@/components/ui/back-button";
import { Skeleton } from "@/components/ui/skeleton";
import { getActor } from "@/server/auth";
import { orNotFound } from "@/server/lib/not-found";
import { getCommunityBySlug, listCommunityPosts } from "@/server/modules/communities";

export const metadata: Metadata = {
  title: "Community · dodoi",
  robots: { index: false, follow: false },
};

type Params = PageProps<"/community/circles/[slug]">["params"];

// A community with its rules and discussions (COM-03…08, F-28). Reading needs sign-in; hidden or
// unknown communities are not found.
export default function CommunityPage({ params }: PageProps<"/community/circles/[slug]">) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-5 pt-4 pb-10 md:px-7 md:pt-8">
      <BackButton fallbackHref="/community/circles" />
      <Suspense fallback={<CommunitySkeleton />}>
        <CommunityContent params={params} />
      </Suspense>
    </div>
  );
}

async function CommunityContent({ params }: { params: Params }) {
  const actor = await getActor();
  const { slug } = await params;
  if (!actor) redirect(`/sign-in?returnTo=${encodeURIComponent(`/community/circles/${slug}`)}`);
  const community = await orNotFound(getCommunityBySlug(actor, slug));
  const posts = await orNotFound(listCommunityPosts(actor, slug));
  return (
    <CommunityView
      key={community.id}
      initialCommunity={community}
      initialPosts={posts}
      isVerified={actor.isEmailVerified}
    />
  );
}

function CommunitySkeleton() {
  return (
    <div role="status" aria-label="Loading the community" className="flex flex-col gap-4">
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-12 w-4/5" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
