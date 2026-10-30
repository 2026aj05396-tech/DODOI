import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { CommunityTabs } from "@/components/community/community-tabs";
import { HelpRequestsView } from "@/components/community/help-requests-view";
import { Skeleton } from "@/components/ui/skeleton";
import { getActor } from "@/server/auth";
import { getHelpBanner, listHelpRequests } from "@/server/modules/help";

export const metadata: Metadata = {
  title: "Community · dodoi",
  robots: { index: false, follow: false },
};

// Community (P3-03, design `1h`; tablet and desktop built from the system): the Help requests tab.
// Sessions (P3-04) stays coming soon until it is built; Your circles (P3-01) lives at /community/circles.
export default function CommunityPage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5 px-5 pt-4 pb-10 md:px-7 md:pt-8 xl:px-10">
      <h1 className="text-greeting text-foreground md:text-greeting-web">Community</h1>
      <CommunityTabs active="help" />
      <Suspense fallback={<HelpSkeleton />}>
        <HelpContent />
      </Suspense>
    </div>
  );
}

async function HelpContent() {
  const actor = await getActor();
  if (!actor) redirect("/sign-in?returnTo=%2Fcommunity");
  const [firstPage, banner] = await Promise.all([
    listHelpRequests(actor, { status: "OPEN" }),
    getHelpBanner(actor),
  ]);
  return (
    <HelpRequestsView
      initialPage={firstPage}
      canHelpSkills={banner.canHelpSkills}
      matchingCount={banner.matchingCount}
    />
  );
}

function HelpSkeleton() {
  return (
    <div role="status" aria-label="Loading requests" className="flex flex-col gap-3">
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-11 w-2/3 rounded-full" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-28 w-full" />
    </div>
  );
}
