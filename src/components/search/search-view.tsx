"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { InfinitePostGrid } from "@/components/posts/infinite-post-grid";
import { MasonrySkeleton } from "@/components/posts/masonry-skeleton";
import { PostGrid } from "@/components/posts/post-grid";
import { SkillCard } from "@/components/skills/skill-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { ApiRequestError } from "@/lib/api-client/request";
import { search, searchAll } from "@/lib/api-client/search";
import type { SearchType } from "@/lib/schemas/search";
import type { Paginated } from "@/lib/types/api";
import type { CreatorSummary, PostCard } from "@/lib/types/posts";
import type { SkillSummary } from "@/lib/types/skills";
import { cn } from "@/lib/utils/cn";

import { MakerRow } from "./maker-row";

// Search results (`/search?q=&type=`, SRCH-01…04; built from the system): tabs All · Posts ·
// Skills · Makers. "All" shows up to 8 of each with "See all"; a tab pages through one kind.

const TABS: { type: SearchType; label: string }[] = [
  { type: "all", label: "All" },
  { type: "posts", label: "Posts" },
  { type: "skills", label: "Skills" },
  { type: "creators", label: "Makers" },
];

const ALL_LIMIT = 8;

function href(q: string, type: SearchType): string {
  const params = new URLSearchParams({ q });
  if (type !== "all") params.set("type", type);
  return `/search?${params}`;
}

function errorText(error: unknown): string {
  return error instanceof ApiRequestError ? error.message : "We couldn't search right now.";
}

function NoResults({ q }: { q: string }) {
  return (
    <EmptyState
      title={`No results for “${q}”`}
      titleAs="h2"
      description="Check the spelling, try a shorter word, or browse ideas in Explore."
      action={
        <Button asChild variant="outline">
          <Link href="/explore">Go to Explore</Link>
        </Button>
      }
    />
  );
}

function SectionHeading({ id, title, seeAll }: { id: string; title: string; seeAll?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 id={id} className="text-section text-foreground">
        {title}
      </h2>
      {seeAll ? (
        <Link href={seeAll} className="text-control font-bold text-link hover:underline">
          See all
        </Link>
      ) : null}
    </div>
  );
}

function AllResults({ q }: { q: string }) {
  const results = useQuery({ queryKey: ["search-all", q], queryFn: () => searchAll(q) });
  if (results.isPending) return <MasonrySkeleton label="Searching" />;
  if (results.isError) {
    return <ErrorState message={errorText(results.error)} onRetry={() => void results.refetch()} />;
  }
  const { posts, skills, creators } = results.data;
  if (posts.length + skills.length + creators.length === 0) return <NoResults q={q} />;

  return (
    <div className="flex flex-col gap-8">
      {skills.length > 0 ? (
        <section aria-labelledby="results-skills" className="flex flex-col gap-3">
          <SectionHeading
            id="results-skills"
            title="Skills"
            seeAll={skills.length >= ALL_LIMIT ? href(q, "skills") : undefined}
          />
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {skills.map((skill) => (
              <li key={skill.id}>
                <SkillCard skill={skill} className="h-full" />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {creators.length > 0 ? (
        <section aria-labelledby="results-makers" className="flex flex-col gap-3">
          <SectionHeading
            id="results-makers"
            title="Makers"
            seeAll={creators.length >= ALL_LIMIT ? href(q, "creators") : undefined}
          />
          <ul className="grid gap-1 md:grid-cols-2 xl:grid-cols-3">
            {creators.map((maker) => (
              <li key={maker.username}>
                <MakerRow maker={maker} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {posts.length > 0 ? (
        <section aria-labelledby="results-posts" className="flex flex-col gap-3">
          <SectionHeading
            id="results-posts"
            title="Posts"
            seeAll={posts.length >= ALL_LIMIT ? href(q, "posts") : undefined}
          />
          <PostGrid posts={posts} />
        </section>
      ) : null}
    </div>
  );
}

function PagedList<T>({
  q,
  type,
  getKey,
  render,
  listClassName,
}: {
  q: string;
  type: "skills" | "creators";
  getKey: (item: T) => string;
  render: (item: T) => React.ReactNode;
  listClassName: string;
}) {
  const results = useInfiniteQuery({
    queryKey: ["search", q, type],
    queryFn: ({ pageParam }) => search(q, type, pageParam) as Promise<Paginated<T>>,
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });
  if (results.isPending) return <MasonrySkeleton label="Searching" />;
  if (results.isError && !results.isFetchNextPageError) {
    return <ErrorState message={errorText(results.error)} onRetry={() => void results.refetch()} />;
  }
  const items = results.data?.pages.flatMap((page) => page.items) ?? [];
  if (items.length === 0) return <NoResults q={q} />;
  return (
    <div className="flex flex-col gap-4">
      <ul className={listClassName}>
        {items.map((item) => (
          <li key={getKey(item)}>{render(item)}</li>
        ))}
      </ul>
      {results.hasNextPage ? (
        <Button
          variant="outline"
          className="self-center"
          disabled={results.isFetchingNextPage}
          onClick={() => void results.fetchNextPage({ cancelRefetch: false })}
        >
          {results.isFetchingNextPage ? "Loading…" : "Load more"}
        </Button>
      ) : null}
    </div>
  );
}

export function SearchView({ q, type }: { q: string; type: SearchType }) {
  if (!q) {
    return (
      <EmptyState
        title="Search skills, projects and makers"
        titleAs="h2"
        description="Try “crochet”, “watercolor” or a maker's name."
        action={
          <Button asChild variant="outline">
            <Link href="/explore">Browse Explore</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Result types" className="flex gap-1 border-b border-border">
        {TABS.map((tab) => {
          const isActive = tab.type === type;
          return (
            <Link
              key={tab.type}
              href={href(q, tab.type)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "-mb-px border-b-2 px-3 pb-2.5 text-control-lg",
                isActive
                  ? "border-link font-bold text-link"
                  : "border-transparent text-foreground-secondary hover:text-foreground",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      {type === "all" ? <AllResults q={q} /> : null}
      {type === "posts" ? (
        <InfinitePostGrid
          queryKey={["search", q, "posts"]}
          fetchPage={(cursor) => search(q, "posts", cursor) as Promise<Paginated<PostCard>>}
          empty={<NoResults q={q} />}
        />
      ) : null}
      {type === "skills" ? (
        <PagedList<SkillSummary>
          q={q}
          type="skills"
          getKey={(skill) => skill.id}
          render={(skill) => <SkillCard skill={skill} className="h-full" />}
          listClassName="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4"
        />
      ) : null}
      {type === "creators" ? (
        <PagedList<CreatorSummary>
          q={q}
          type="creators"
          getKey={(maker) => maker.username}
          render={(maker) => <MakerRow maker={maker} />}
          listClassName="grid gap-1 md:grid-cols-2 xl:grid-cols-3"
        />
      ) : null}
    </div>
  );
}
