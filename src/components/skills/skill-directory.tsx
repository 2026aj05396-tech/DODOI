"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useDeferredValue, useState } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { SearchField } from "@/components/ui/search-field";
import { Skeleton } from "@/components/ui/skeleton";
import { listSkillsPage } from "@/lib/api-client/skills";

import { SkillCard } from "./skill-card";

// All skills (`/explore/skills`, "See all" in Explore; PO decision P1-26): every active skill A–Z,
// predefined and custom (SRCH-07), with a filter box and each skill's hint.

export function SkillDirectory() {
  const [filter, setFilter] = useState("");
  const term = useDeferredValue(filter.trim());

  const skills = useInfiniteQuery({
    queryKey: ["skill-directory", term],
    queryFn: ({ pageParam }) => listSkillsPage(term, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });
  const items = skills.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="flex flex-col gap-5">
      <SearchField
        label="Filter skills"
        placeholder="Filter skills"
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
        className="md:max-w-md"
      />
      {skills.isPending ? (
        <div
          role="status"
          aria-label="Loading skills"
          className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4"
        >
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="h-19" />
          ))}
        </div>
      ) : skills.isError ? (
        <ErrorState message="We couldn't load skills." onRetry={() => void skills.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          title={`No skills match “${term}”`}
          titleAs="h2"
          description="Try a shorter word, or add it as your own interest in Your skills."
        />
      ) : (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {items.map((skill) => (
            <li key={skill.id}>
              <SkillCard skill={skill} className="h-full" />
            </li>
          ))}
        </ul>
      )}
      {skills.hasNextPage ? (
        <Button
          variant="outline"
          className="self-center"
          disabled={skills.isFetchingNextPage}
          onClick={() => void skills.fetchNextPage({ cancelRefetch: false })}
        >
          {skills.isFetchingNextPage ? "Loading…" : "Load more"}
        </Button>
      ) : null}
    </div>
  );
}
