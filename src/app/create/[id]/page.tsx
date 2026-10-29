import type { Metadata } from "next";
import { Suspense } from "react";

import { CreatePostFlow } from "@/components/create/create-post-flow";
import { CreateSkeleton } from "@/components/create/create-skeleton";
import { orNotFound } from "@/server/lib/not-found";

import { loadCreateContext } from "../load-create-context";

export const metadata: Metadata = { title: "Edit post · dodoi" };

// A draft picked up again, or a published post being edited (F-17 steps 6–7). Opens on Details.
export default function EditPostPage({ params }: PageProps<"/create/[id]">) {
  return (
    <Suspense fallback={<CreateSkeleton />}>
      <EditContent params={params} />
    </Suspense>
  );
}

async function EditContent({ params }: { params: PageProps<"/create/[id]">["params"] }) {
  const { id } = await params;
  const context = await orNotFound(loadCreateContext(`/create/${id}`, id));
  return <CreatePostFlow {...context} />;
}
