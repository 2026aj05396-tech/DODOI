import type { Metadata } from "next";
import { Suspense } from "react";

import { CreatePostFlow } from "@/components/create/create-post-flow";
import { CreateSkeleton } from "@/components/create/create-skeleton";

import { loadCreateContext } from "./load-create-context";

export const metadata: Metadata = { title: "New post · dodoi" };

// Create post (P2-02, F-17): full screen, outside the app shell, like Instagram's composer.
export default function CreatePage() {
  return (
    <Suspense fallback={<CreateSkeleton />}>
      <CreateContent />
    </Suspense>
  );
}

async function CreateContent() {
  const context = await loadCreateContext("/create");
  return <CreatePostFlow {...context} />;
}
