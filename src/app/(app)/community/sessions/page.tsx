import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { CommunityHeader } from "@/components/community/community-header";
import { CommunityTabs } from "@/components/community/community-tabs";
import { SessionsView } from "@/components/sessions/sessions-view";
import { Skeleton } from "@/components/ui/skeleton";
import { getActor } from "@/server/auth";
import { listSessions } from "@/server/modules/sessions";

export const metadata: Metadata = {
  title: "Sessions · dodoi",
  robots: { index: false, follow: false },
};

// Community → Sessions (P3-04, F-30 step 4): upcoming and past sessions. Tablet and desktop are
// built from the system.
export default function SessionsPage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5 px-5 pt-4 pb-10 md:px-7 md:pt-8 xl:px-10">
      <CommunityHeader />
      <CommunityTabs active="sessions" />
      <Suspense fallback={<SessionsSkeleton />}>
        <SessionsContent />
      </Suspense>
    </div>
  );
}

async function SessionsContent() {
  const actor = await getActor();
  if (!actor) redirect("/sign-in?returnTo=%2Fcommunity%2Fsessions");
  return <SessionsView initialUpcoming={await listSessions(actor, { scope: "upcoming" })} />;
}

function SessionsSkeleton() {
  return (
    <div role="status" aria-label="Loading sessions" className="flex flex-col gap-3">
      <Skeleton className="h-11 w-48 rounded-full" />
      <Skeleton className="h-36 w-full" />
      <Skeleton className="h-36 w-full" />
    </div>
  );
}
