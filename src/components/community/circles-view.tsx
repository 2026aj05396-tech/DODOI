"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { SearchField } from "@/components/ui/search-field";
import { Skeleton } from "@/components/ui/skeleton";
import { listCommunities } from "@/lib/api-client/communities";
import type { CommunityCard as CommunityCardData } from "@/lib/types/communities";

import { CommunityCard } from "./community-card";

// The Your circles tab (COM-03, F-28 steps 1–3): the communities the member joined, then "Find
// communities" with a name search (interests first, then newest), and Start a community.

type Page = { items: CommunityCardData[]; nextCursor: string | null };

function useDebounced(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function CardList({ items }: { items: CommunityCardData[] }) {
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {items.map((community) => (
        <li key={community.id}>
          <CommunityCard community={community} className="h-full" />
        </li>
      ))}
    </ul>
  );
}

export function CirclesView({
  initialMine,
  initialFind,
}: {
  initialMine: Page;
  initialFind: Page;
}) {
  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim(), 300);

  const mine = useInfiniteQuery({
    queryKey: ["communities", "mine"],
    queryFn: ({ pageParam }) => listCommunities({ mine: true, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    initialData: { pages: [initialMine], pageParams: [null] },
    staleTime: 30_000,
  });
  const find = useInfiniteQuery({
    queryKey: ["communities", "find", q],
    queryFn: ({ pageParam }) => listCommunities({ q, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    ...(q === ""
      ? { initialData: { pages: [initialFind], pageParams: [null] }, staleTime: 30_000 }
      : { staleTime: 0 }),
  });
  const mineItems = mine.data?.pages.flatMap((page) => page.items) ?? [];
  const findItems = find.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="circles-mine" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="circles-mine" className="text-section text-foreground">
            Your circles
          </h2>
          <Button asChild>
            <Link href="/community/circles/new">Start a community</Link>
          </Button>
        </div>
        {mineItems.length === 0 ? (
          <EmptyState
            icon={<Users />}
            title="You haven't joined a circle yet"
            description="Find a community for your craft below, or start your own."
          />
        ) : (
          <CardList items={mineItems} />
        )}
        {mine.hasNextPage ? (
          <Button
            variant="outline"
            className="self-center"
            disabled={mine.isFetchingNextPage}
            onClick={() => void mine.fetchNextPage()}
          >
            {mine.isFetchingNextPage ? "Loading…" : "Show more"}
          </Button>
        ) : null}
      </section>

      <section aria-labelledby="circles-find" className="flex flex-col gap-3">
        <h2 id="circles-find" className="text-section text-foreground">
          Find communities
        </h2>
        <SearchField
          label="Search communities by name"
          placeholder="Search by name"
          appearance="outline"
          value={search}
          maxLength={60}
          onChange={(event) => setSearch(event.target.value)}
        />
        {find.isPending ? (
          <div role="status" aria-label="Loading communities" className="flex flex-col gap-3">
            {[0, 1, 2].map((row) => (
              <Skeleton key={row} className="h-24 w-full" />
            ))}
          </div>
        ) : find.isError && findItems.length === 0 ? (
          <ErrorState message="We couldn't load communities." onRetry={() => void find.refetch()} />
        ) : findItems.length === 0 ? (
          <EmptyState
            icon={<Users />}
            title={q ? "No communities match that name" : "No communities yet"}
            description={
              q ? "Try another word, or start one with that name." : "Be the first to start one."
            }
          />
        ) : (
          <CardList items={findItems} />
        )}
        {find.hasNextPage ? (
          <Button
            variant="outline"
            className="self-center"
            disabled={find.isFetchingNextPage}
            onClick={() => void find.fetchNextPage()}
          >
            {find.isFetchingNextPage ? "Loading…" : "Show more"}
          </Button>
        ) : null}
      </section>
    </div>
  );
}
