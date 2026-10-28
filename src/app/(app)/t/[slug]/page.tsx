import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { ThemePosts } from "@/components/explore/theme-posts";
import { MasonrySkeleton } from "@/components/posts/masonry-skeleton";
import { BackButton } from "@/components/ui/back-button";
import { PatternTile } from "@/components/ui/pattern-tile";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils/cn";
import { getActor } from "@/server/auth";
import { orNotFound } from "@/server/lib/not-found";
import { getTheme } from "@/server/modules/content";

export const metadata: Metadata = {
  title: "Theme · dodoi",
};

type Params = PageProps<"/t/[slug]">["params"];

// Theme page (P1-26; not designed, built from the system): cover or pattern, "12 ideas", title,
// description, then its posts in the editors' order.
export default function ThemePage({ params }: PageProps<"/t/[slug]">) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 pt-4 pb-10 md:px-7 md:pt-8 xl:px-10">
      <Suspense fallback={<ThemeSkeleton />}>
        <ThemeContent params={params} />
      </Suspense>
    </div>
  );
}

async function ThemeContent({ params }: { params: Params }) {
  const actor = await getActor();
  const { slug } = await params;
  if (!actor) redirect(`/sign-in?returnTo=${encodeURIComponent(`/t/${slug}`)}`);
  const { theme, posts } = await orNotFound(getTheme(actor, slug, { limit: 20 }));
  return (
    <>
      <BackButton fallbackHref="/explore" />
      <header className="relative overflow-hidden rounded-card">
        {theme.coverMedia ? (
          // eslint-disable-next-line @next/next/no-img-element -- Cloudinary serves the sizes in srcSet.
          <img
            src={theme.coverMedia.url}
            srcSet={theme.coverMedia.srcSet}
            sizes="(min-width: 1024px) 960px, 100vw"
            alt=""
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <PatternTile accent="butter" className="absolute inset-0 rounded-none" />
        )}
        <div className="relative flex min-h-44 flex-col justify-end gap-2 p-5 md:min-h-56 md:p-8">
          <p
            className={cn(
              "self-start text-overline text-foreground uppercase",
              theme.coverMedia && "rounded-full bg-background/90 px-2.5 py-0.5",
            )}
          >
            {theme.postCount} {theme.postCount === 1 ? "idea" : "ideas"}
          </p>
          <h1
            className={cn(
              "self-start text-title text-foreground md:text-title-web",
              theme.coverMedia && "rounded-md bg-background/90 px-2.5 py-1",
            )}
          >
            {theme.title}
          </h1>
        </div>
      </header>
      {theme.description ? (
        <p className="max-w-2xl text-body-lg text-foreground md:text-body-lg-web">
          {theme.description}
        </p>
      ) : null}
      <ThemePosts slug={theme.slug} initialPage={posts} />
    </>
  );
}

function ThemeSkeleton() {
  return (
    <div role="status" aria-label="Loading the theme" className="flex flex-col gap-6">
      <Skeleton className="h-44 w-full md:h-56" />
      <MasonrySkeleton />
    </div>
  );
}
