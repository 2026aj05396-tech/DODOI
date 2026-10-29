import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { JournalList } from "@/components/journal/journal-list";
import { Skeleton } from "@/components/ui/skeleton";
import { getActor } from "@/server/auth";
import { listMyProjects } from "@/server/modules/journal";
import { getMySkills } from "@/server/modules/users";

export const metadata: Metadata = { title: "Journal · dodoi" };

// Creative journal (P2-03, F-18): the maker's projects. Built from the system; the project page
// follows design `1g`.
export default function JournalPage() {
  return (
    <div className="px-5 pt-3 pb-8 md:px-7 md:pt-8 xl:px-10">
      <h1 className="mb-3 text-greeting text-foreground md:text-greeting-web">Journal</h1>
      <Suspense fallback={<JournalSkeleton />}>
        <JournalContent />
      </Suspense>
    </div>
  );
}

async function JournalContent() {
  const actor = await getActor();
  if (!actor) redirect("/sign-in?returnTo=%2Fjournal");
  const [projects, mySkills] = await Promise.all([listMyProjects(actor, {}), getMySkills(actor)]);
  const interests = mySkills.items.filter((item) => item.isInterest).map((item) => item.skill);
  return <JournalList projects={projects} skills={interests} />;
}

function JournalSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading your projects"
      className="grid grid-cols-2 gap-4 md:grid-cols-3"
    >
      <Skeleton className="aspect-[4/3] w-full rounded-card" />
      <Skeleton className="aspect-[4/3] w-full rounded-card" />
      <Skeleton className="hidden aspect-[4/3] w-full rounded-card md:block" />
    </div>
  );
}
