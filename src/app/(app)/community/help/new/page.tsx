import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AskHelpForm } from "@/components/community/ask-help-form";
import { BackButton } from "@/components/ui/back-button";
import { Skeleton } from "@/components/ui/skeleton";
import { HELP_BODY_MAX, HELP_TITLE_MAX } from "@/lib/schemas/help";
import { getActor } from "@/server/auth";
import { getActivePredefinedSkills } from "@/server/modules/skills";

export const metadata: Metadata = {
  title: "Ask for help · dodoi",
  robots: { index: false, follow: false },
};

type SearchParams = PageProps<"/community/help/new">["searchParams"];

// Ask for help (HLP-01, F-27 step 1). `?q=` fills the details (from "Ask the community" in the AI
// chat, HLP-05), `?skill=` the craft.
export default function NewHelpRequestPage({ searchParams }: PageProps<"/community/help/new">) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-5 pt-4 pb-10 md:px-7 md:pt-8">
      <div className="flex flex-col gap-2">
        <BackButton fallbackHref="/community" />
        <h1 className="text-greeting text-foreground md:text-greeting-web">Ask for help</h1>
        <p className="text-body text-foreground-secondary">
          Other makers who know this craft can answer. Don&apos;t share anything personal.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-card" />}>
        <FormContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

async function FormContent({ searchParams }: { searchParams: SearchParams }) {
  const actor = await getActor();
  if (!actor) redirect("/sign-in?returnTo=%2Fcommunity%2Fhelp%2Fnew");
  const [query, skills] = await Promise.all([searchParams, getActivePredefinedSkills()]);
  const question = first(query.q).trim();
  return (
    <AskHelpForm
      skills={skills.map(({ id, name }) => ({ id, name }))}
      isVerified={actor.isEmailVerified}
      initial={{
        title: question.slice(0, HELP_TITLE_MAX),
        body: question.slice(0, HELP_BODY_MAX),
        skillId: first(query.skill),
      }}
    />
  );
}
