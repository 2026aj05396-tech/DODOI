import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { ProjectView } from "@/components/journal/project-view";
import { BackButton } from "@/components/ui/back-button";
import { Skeleton } from "@/components/ui/skeleton";
import { getActor } from "@/server/auth";
import { orNotFound } from "@/server/lib/not-found";
import { getProject } from "@/server/modules/journal";

export const metadata: Metadata = { title: "Project · dodoi" };

// A journal project (P2-03, F-18, design `1g`). The owner's, or a public one.
export default function ProjectPage({ params }: PageProps<"/projects/[id]">) {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 pt-4 md:px-7 md:pt-8">
      <Suspense fallback={<ProjectSkeleton />}>
        <ProjectContent params={params} />
      </Suspense>
    </div>
  );
}

async function ProjectContent({ params }: { params: PageProps<"/projects/[id]">["params"] }) {
  const actor = await getActor();
  const { id } = await params;
  if (!actor) redirect(`/sign-in?returnTo=${encodeURIComponent(`/projects/${id}`)}`);
  const project = await orNotFound(getProject(actor, id));
  return (
    <div className="flex flex-col gap-3">
      <BackButton fallbackHref={project.isOwner ? "/journal" : `/u/${project.owner.username}`} />
      <ProjectView project={project} />
    </div>
  );
}

function ProjectSkeleton() {
  return (
    <div role="status" aria-label="Loading the project" className="flex flex-col gap-4">
      <Skeleton className="h-6 w-40 rounded-xs" />
      <Skeleton className="h-10 w-4/5 rounded-md" />
      <Skeleton className="h-5 w-56 rounded-md" />
      <Skeleton className="h-64 w-full rounded-card" />
    </div>
  );
}
