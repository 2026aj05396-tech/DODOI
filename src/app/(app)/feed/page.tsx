import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { FeedHeader } from "@/components/feed/feed-header";
import { FeedRail } from "@/components/feed/feed-rail";
import { HomeFeed } from "@/components/feed/home-feed";
import { PageWithRail } from "@/components/layout/page-with-rail";
import { MasonrySkeleton } from "@/components/posts/masonry-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { feedGreeting, firstName } from "@/lib/utils/greeting";
import { getActor } from "@/server/auth";
import { getFeed, getFeedFilters, getSkillSuggestion } from "@/server/modules/feed";
import { getDisplayName } from "@/server/modules/users";

export const metadata: Metadata = {
  title: "Home · dodoi",
};

// Home feed (P1-22; `1c` mobile, `3c` tablet, `2b` desktop). The first For you page, the chips and
// the rail's suggestion are loaded here; the feed itself pages in the browser (HomeFeed).
export default function FeedPage() {
  return (
    <Suspense fallback={<FeedPageSkeleton />}>
      <FeedContent />
    </Suspense>
  );
}

async function FeedContent() {
  const actor = await getActor();
  if (!actor) redirect("/sign-in?returnTo=%2Ffeed");
  const [displayName, chips, firstPage, suggestion] = await Promise.all([
    getDisplayName(actor.id),
    getFeedFilters(actor),
    getFeed(actor, { filter: "for-you", limit: 20 }),
    getSkillSuggestion(actor),
  ]);
  const initial = (displayName ? firstName(displayName) : null)?.charAt(0) ?? "d";

  return (
    <PageWithRail rail={<FeedRail suggestion={suggestion} />}>
      <div className="px-5 pt-2 pb-6 md:px-7 md:pt-6 xl:px-8">
        <FeedHeader initial={initial} />
        <h1 className="mt-2 mb-4 text-greeting text-balance text-foreground md:mt-6 md:mb-5 md:text-greeting-web">
          {feedGreeting(displayName)}
        </h1>
        <HomeFeed chips={chips} initialPage={firstPage} />
      </div>
    </PageWithRail>
  );
}

function FeedPageSkeleton() {
  return (
    <div className="px-5 pt-2 md:px-7 md:pt-6 xl:px-8">
      <Skeleton className="hidden h-11.5 w-full rounded-full md:block" />
      <Skeleton className="mt-2 mb-4 h-8 w-3/4 max-w-md rounded-md md:mt-6" />
      <div className="mb-5 flex gap-2">
        <Skeleton className="h-9 w-20 rounded-full" />
        <Skeleton className="h-9 w-24 rounded-full" />
        <Skeleton className="h-9 w-24 rounded-full" />
      </div>
      <MasonrySkeleton />
    </div>
  );
}
