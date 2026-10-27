import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { MasonrySkeleton } from "@/components/posts/masonry-skeleton";
import { InterestToggle } from "@/components/skills/interest-toggle";
import { SkillChipLink } from "@/components/skills/skill-chip-link";
import { SkillPosts } from "@/components/skills/skill-posts";
import { PatternTile, type PatternAccent } from "@/components/ui/pattern-tile";
import { Skeleton } from "@/components/ui/skeleton";
import { getActor } from "@/server/auth";
import { orNotFound } from "@/server/lib/not-found";
import { listSkillPosts } from "@/server/modules/content";
import { getSkillBySlug } from "@/server/modules/skills";
import { getInterestProfile } from "@/server/modules/users";

export const metadata: Metadata = {
  title: "Skill · dodoi",
};

type Params = PageProps<"/s/[slug]">["params"];

// Skill page (P1-26, SRCH-06/07; not designed, built from the system): the skill, its hint and
// description, "Add to my interests" (PO decision), related skills and its posts, newest first.
export default function SkillPage({ params }: PageProps<"/s/[slug]">) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 pt-4 pb-10 md:px-7 md:pt-8 xl:px-10">
      <Suspense fallback={<SkillSkeleton />}>
        <SkillContent params={params} />
      </Suspense>
    </div>
  );
}

async function SkillContent({ params }: { params: Params }) {
  const actor = await getActor();
  const { slug } = await params;
  if (!actor) redirect(`/sign-in?returnTo=${encodeURIComponent(`/s/${slug}`)}`);
  const skill = await orNotFound(getSkillBySlug(actor, slug));
  const [posts, interests] = await Promise.all([
    orNotFound(listSkillPosts(actor, slug, { limit: 20 })),
    getInterestProfile(actor.id),
  ]);
  const isInterest = interests.some((row) => row.skillId === skill.id);

  return (
    <>
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
        <PatternTile
          accent={skill.accent.toLowerCase() as PatternAccent}
          className="h-24 w-full shrink-0 md:size-28"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h1 className="text-hero break-words text-foreground md:text-hero-web">{skill.name}</h1>
          {skill.hint ? (
            <p className="self-start rounded-full bg-muted px-3 py-1 text-meta text-foreground">
              {skill.hint}
            </p>
          ) : null}
          {skill.description ? (
            <p className="max-w-2xl text-body-lg text-foreground md:text-body-lg-web">
              {skill.description}
            </p>
          ) : null}
          <div className="mt-1">
            <InterestToggle skillId={skill.id} skillName={skill.name} initial={isInterest} />
          </div>
        </div>
      </header>

      {skill.relatedSkills.length > 0 ? (
        <section aria-labelledby="related-skills" className="flex flex-col gap-2">
          <h2 id="related-skills" className="text-overline text-foreground-secondary uppercase">
            Related skills
          </h2>
          <ul className="flex flex-wrap gap-2">
            {skill.relatedSkills.map((related) => (
              <li key={related.id}>
                <SkillChipLink skill={related} className="px-3.5 py-1.5 text-control-sm" />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="skill-posts" className="flex flex-col gap-3">
        <h2 id="skill-posts" className="text-section text-foreground">
          Ideas and projects
        </h2>
        <SkillPosts slug={skill.slug} name={skill.name} initialPage={posts} />
      </section>
    </>
  );
}

function SkillSkeleton() {
  return (
    <div role="status" aria-label="Loading the skill" className="flex flex-col gap-6">
      <Skeleton className="h-24 w-full md:h-28 md:w-2/3" />
      <Skeleton className="h-11 w-48 rounded-full" />
      <MasonrySkeleton />
    </div>
  );
}
