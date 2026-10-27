import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { SavedView } from "@/components/collections/saved-view";
import { MasonrySkeleton } from "@/components/posts/masonry-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { getActor } from "@/server/auth";
import { listCollections, listSavedPosts } from "@/server/modules/library";

export const metadata: Metadata = {
  title: "Saved · dodoi",
};

// Saved (P1-25, COLL-01…07): collections, then All saved. Built from the system (PO review).
export default function SavedPage() {
  return (
    <div className="px-5 pt-3 pb-8 md:px-7 md:pt-8 xl:px-10">
      <h1 className="mb-5 text-greeting text-foreground md:text-greeting-web">Saved</h1>
      <Suspense fallback={<SavedSkeleton />}>
        <SavedContent />
      </Suspense>
    </div>
  );
}

async function SavedContent() {
  const actor = await getActor();
  if (!actor) redirect("/sign-in?returnTo=%2Fsaved");
  const [collections, saves] = await Promise.all([
    listCollections(actor),
    listSavedPosts(actor, { limit: 20 }),
  ]);
  return <SavedView initialCollections={collections} initialSaves={saves} />;
}

function SavedSkeleton() {
  return (
    <div role="status" aria-label="Loading your saved posts" className="flex flex-col gap-8">
      <div className="flex gap-3">
        <Skeleton className="h-30 w-40 shrink-0" />
        <Skeleton className="h-30 w-40 shrink-0" />
        <Skeleton className="hidden h-30 w-40 shrink-0 md:block" />
      </div>
      <MasonrySkeleton />
    </div>
  );
}
