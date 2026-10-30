import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { CirclesView } from "@/components/community/circles-view";
import { CommunityTabs } from "@/components/community/community-tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { getActor } from "@/server/auth";
import { listCommunities } from "@/server/modules/communities";

export const metadata: Metadata = {
  title: "Your circles · dodoi",
  robots: { index: false, follow: false },
};

// Community → Your circles (P3-01, COM-03, F-28): the member's communities, discovery with a name
// search, and Start a community. Tablet and desktop are built from the system.
export default function CirclesPage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5 px-5 pt-4 pb-10 md:px-7 md:pt-8 xl:px-10">
      <h1 className="text-greeting text-foreground md:text-greeting-web">Community</h1>
      <CommunityTabs active="circles" />
      <Suspense fallback={<CirclesSkeleton />}>
        <CirclesContent />
      </Suspense>
    </div>
  );
}

async function CirclesContent() {
  const actor = await getActor();
  if (!actor) redirect("/sign-in?returnTo=%2Fcommunity%2Fcircles");
  const [mine, find] = await Promise.all([
    listCommunities(actor, { mine: true }),
    listCommunities(actor, {}),
  ]);
  return <CirclesView initialMine={mine} initialFind={find} />;
}

function CirclesSkeleton() {
  return (
    <div role="status" aria-label="Loading communities" className="flex flex-col gap-3">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
