import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { ThemeCard } from "@/components/explore/theme-card";
import { MasonrySkeleton } from "@/components/posts/masonry-skeleton";
import { PostGrid } from "@/components/posts/post-grid";
import { SearchBox } from "@/components/search/search-box";
import { SkillCard } from "@/components/skills/skill-card";
import { SkillChipLink } from "@/components/skills/skill-chip-link";
import { ComingSoonBadge } from "@/components/ui/coming-soon";
import { Skeleton } from "@/components/ui/skeleton";
import { getActor } from "@/server/auth";
import { explore } from "@/server/modules/search";

export const metadata: Metadata = {
  title: "Explore · dodoi",
};

/** Ideas for "Use what you have" (`1d`), shown as coming soon until Phase 2. */
const USE_WHAT_YOU_HAVE = ["Leftover yarn", "Old jeans", "Pipe cleaners", "Bottle caps"];

// Explore (P1-26, SRCH-05; design `1d`, tablet/desktop built from the system). Designed sections
// first, then popular, new and beginner-friendly (PO decision, P1-26).
export default function ExplorePage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 pt-3 pb-10 md:px-7 md:pt-8 xl:px-10">
      <div className="flex flex-col gap-4">
        <h1 className="text-hero text-foreground md:text-hero-web">Explore</h1>
        <SearchBox placeholder="Skills, projects, makers" className="md:max-w-xl" />
      </div>
      <Suspense fallback={<ExploreSkeleton />}>
        <ExploreContent />
      </Suspense>
    </div>
  );
}

function Section({
  id,
  title,
  action,
  children,
}: {
  id: string;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id={id} className="text-section text-foreground">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

async function ExploreContent() {
  const actor = await getActor();
  if (!actor) redirect("/sign-in?returnTo=%2Fexplore");
  const data = await explore(actor);

  return (
    <>
      {data.themes.length > 0 ? (
        <Section id="explore-themes" title="Themes this week">
          <ul className="-mx-5 flex scrollbar-none gap-3 overflow-x-auto px-5 pb-2 md:mx-0 md:flex-wrap md:px-0">
            {data.themes.map((theme, index) => (
              <li key={theme.id}>
                <ThemeCard theme={theme} index={index} />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {data.skillsToTry.length > 0 ? (
        <Section
          id="explore-try"
          title="Skills to try"
          action={
            <Link
              href="/explore/skills"
              className="text-control font-bold text-link hover:underline"
            >
              See all
            </Link>
          }
        >
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {data.skillsToTry.map(({ skill, hint }) => (
              <li key={skill.id}>
                <SkillCard skill={skill} hint={hint} className="h-full" />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <section aria-labelledby="explore-use" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="explore-use" className="text-section text-foreground-secondary">
            Use what you have
          </h2>
          <ComingSoonBadge />
        </div>
        <ul className="flex scrollbar-none gap-2 overflow-x-auto rounded-card border-control border-dashed border-border-faint p-2.5">
          {USE_WHAT_YOU_HAVE.map((item) => (
            <li
              key={item}
              className="shrink-0 rounded-full border border-border-strong bg-background px-3 py-1.5 text-control-sm text-foreground-secondary"
            >
              {item}
            </li>
          ))}
        </ul>
      </section>

      {data.popularSkills.length > 0 ? (
        <Section id="explore-popular" title="Popular skills">
          <ul className="flex flex-wrap gap-2">
            {data.popularSkills.map((skill) => (
              <li key={skill.id}>
                <SkillChipLink skill={skill} className="px-3.5 py-1.5 text-control-sm" />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {data.newSkills.length > 0 ? (
        <Section id="explore-new" title="New on dodoi">
          <ul className="flex flex-wrap gap-2">
            {data.newSkills.map((skill) => (
              <li key={skill.id}>
                <SkillChipLink skill={skill} className="px-3.5 py-1.5 text-control-sm" />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {data.beginnerFriendly.length > 0 ? (
        <Section id="explore-beginner" title="Beginner-friendly projects">
          <PostGrid posts={data.beginnerFriendly} />
        </Section>
      ) : null}
    </>
  );
}

function ExploreSkeleton() {
  return (
    <div role="status" aria-label="Loading Explore" className="flex flex-col gap-8">
      <div className="flex gap-3">
        <Skeleton className="h-40 w-45 shrink-0" />
        <Skeleton className="h-40 w-45 shrink-0" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Skeleton className="h-19" />
        <Skeleton className="h-19" />
        <Skeleton className="h-19" />
        <Skeleton className="h-19" />
      </div>
      <MasonrySkeleton />
    </div>
  );
}
