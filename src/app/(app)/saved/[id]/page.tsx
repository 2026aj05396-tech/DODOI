import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { CollectionView } from "@/components/collections/collection-view";
import { MasonrySkeleton } from "@/components/posts/masonry-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { getActor } from "@/server/auth";
import { orNotFound } from "@/server/lib/not-found";
import { getCollection } from "@/server/modules/library";

export const metadata: Metadata = {
  title: "Collection · dodoi",
  robots: { index: false, follow: false },
};

type Params = PageProps<"/saved/[id]">["params"];

// Collection page (P1-25): the owner's, or someone's public collection; otherwise not found
// (E2E-11). Built from the system (PO review).
export default function CollectionPage({ params }: PageProps<"/saved/[id]">) {
  return (
    <div className="px-5 pt-3 pb-8 md:px-7 md:pt-8 xl:px-10">
      <Suspense fallback={<CollectionSkeleton />}>
        <CollectionContent params={params} />
      </Suspense>
    </div>
  );
}

async function CollectionContent({ params }: { params: Params }) {
  const actor = await getActor();
  const { id } = await params;
  if (!actor) redirect(`/sign-in?returnTo=${encodeURIComponent(`/saved/${id}`)}`);
  const page = await orNotFound(getCollection(actor, id, { limit: 20 }));
  return <CollectionView key={id} initialPage={page} />;
}

function CollectionSkeleton() {
  return (
    <div role="status" aria-label="Loading the collection" className="flex flex-col gap-6">
      <Skeleton className="h-9 w-2/3 max-w-sm rounded-md" />
      <Skeleton className="h-5 w-40 rounded-md" />
      <MasonrySkeleton />
    </div>
  );
}
