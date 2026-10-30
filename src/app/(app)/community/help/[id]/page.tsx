import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { HelpRequestView } from "@/components/community/help-request-view";
import { BackButton } from "@/components/ui/back-button";
import { Skeleton } from "@/components/ui/skeleton";
import { getActor } from "@/server/auth";
import { orNotFound } from "@/server/lib/not-found";
import { getHelpRequest } from "@/server/modules/help";

export const metadata: Metadata = {
  title: "Help request · dodoi",
  robots: { index: false, follow: false },
};

type Params = PageProps<"/community/help/[id]">["params"];

// A help request with its responses (HLP-02, F-27). Reading needs sign-in; hidden, blocked or
// unknown requests are not found.
export default function HelpRequestPage({ params }: PageProps<"/community/help/[id]">) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-5 pt-4 pb-10 md:px-7 md:pt-8">
      <BackButton fallbackHref="/community" />
      <Suspense fallback={<RequestSkeleton />}>
        <RequestContent params={params} />
      </Suspense>
    </div>
  );
}

async function RequestContent({ params }: { params: Params }) {
  const actor = await getActor();
  const { id } = await params;
  if (!actor) redirect(`/sign-in?returnTo=${encodeURIComponent(`/community/help/${id}`)}`);
  const request = await orNotFound(getHelpRequest(actor, id));
  return <HelpRequestView key={request.id} initial={request} isVerified={actor.isEmailVerified} />;
}

function RequestSkeleton() {
  return (
    <div role="status" aria-label="Loading the request" className="flex flex-col gap-4">
      <Skeleton className="h-7 w-48 rounded-full" />
      <Skeleton className="h-12 w-4/5" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
