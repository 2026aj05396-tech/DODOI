"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { HandHeart } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ToggleChip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { listHelpRequests, type HelpListFilter } from "@/lib/api-client/help";
import type { HelpRequestCard as HelpRequestCardData } from "@/lib/types/help";

import { HelpRequestCard } from "./help-request-card";

// The Help requests tab (HLP-01, HLP-03, HLP-04; design `1h`): a banner with the member's
// "can help with" skills and how many open requests match, filter chips, and the list.

type FilterKey = "open" | "in-progress" | "resolved" | "mine";
const FILTERS: { key: FilterKey; label: string; filter: HelpListFilter }[] = [
  { key: "open", label: "Open", filter: { status: "OPEN" } },
  { key: "in-progress", label: "In progress", filter: { status: "IN_PROGRESS" } },
  { key: "resolved", label: "Resolved", filter: { status: "RESOLVED" } },
  { key: "mine", label: "My requests", filter: { mine: true, status: undefined } },
];

const EMPTY: Record<FilterKey, { title: string; description: string }> = {
  open: {
    title: "No open requests right now",
    description: "When someone asks for help, it shows here. Or ask your own question.",
  },
  "in-progress": {
    title: "Nothing in progress",
    description: "Requests move here once the asker is working with a helper.",
  },
  resolved: {
    title: "No resolved requests yet",
    description: "Resolved requests stay here for 90 days.",
  },
  mine: {
    title: "You haven't asked for help yet",
    description: "Stuck on a stitch, a wash or a glaze? Ask other makers.",
  },
};

export function HelpRequestsView({
  initialPage,
  canHelpSkills,
  matchingCount,
}: {
  initialPage: { items: HelpRequestCardData[]; nextCursor: string | null };
  /** Names of the skills the member listed under "can help with". */
  canHelpSkills: string[];
  /** How many open requests in those skills the member could answer. */
  matchingCount: number;
}) {
  const [active, setActive] = useState<FilterKey>("open");
  const filter = FILTERS.find((entry) => entry.key === active)?.filter ?? {};
  const query = useInfiniteQuery({
    queryKey: ["help-requests", active],
    queryFn: ({ pageParam }) => listHelpRequests({ ...filter, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    // The first page for "Open" comes from the server; the others load on demand.
    ...(active === "open"
      ? { initialData: { pages: [initialPage], pageParams: [null] }, staleTime: 30_000 }
      : { staleTime: 0 }),
  });
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="flex flex-col gap-5">
      {canHelpSkills.length > 0 ? (
        <section
          aria-label="Requests you could help with"
          className="rounded-card bg-lavender p-4 text-foreground"
        >
          <p className="text-control-lg font-bold">You can help with: {canHelpSkills.join(", ")}</p>
          <p className="text-body">
            {matchingCount === 0
              ? "No open requests match your skills right now."
              : `${matchingCount} open ${matchingCount === 1 ? "request matches" : "requests match"} your skills.`}
          </p>
        </section>
      ) : (
        <section aria-label="Help other makers" className="rounded-card bg-muted p-4">
          <p className="text-body text-foreground">
            Add the skills you can help with and we&apos;ll show you the questions you could answer.{" "}
            <Link href="/settings/skills" className="font-bold text-link hover:underline">
              Choose skills
            </Link>
          </p>
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Show" className="flex flex-wrap gap-2">
          {FILTERS.map(({ key, label }) => (
            <ToggleChip key={key} pressed={active === key} onPressedChange={() => setActive(key)}>
              {label}
            </ToggleChip>
          ))}
        </div>
        <Button asChild>
          <Link href="/community/help/new">Ask for help</Link>
        </Button>
      </div>

      {query.isPending ? (
        <div role="status" aria-label="Loading requests" className="flex flex-col gap-3">
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="h-28 w-full" />
          ))}
        </div>
      ) : query.isError && items.length === 0 ? (
        <ErrorState message="We couldn't load the requests." onRetry={() => void query.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<HandHeart />}
          title={EMPTY[active].title}
          description={EMPTY[active].description}
          action={
            <Button asChild variant="outline">
              <Link href="/community/help/new">Ask for help</Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {items.map((request) => (
            <li key={request.id}>
              <HelpRequestCard request={request} className="h-full" />
            </li>
          ))}
        </ul>
      )}

      {query.hasNextPage ? (
        <Button
          variant="outline"
          className="self-center"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          {query.isFetchingNextPage ? "Loading…" : "Show more"}
        </Button>
      ) : null}
    </div>
  );
}
