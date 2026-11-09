"use client";

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ToggleChip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { listSessions } from "@/lib/api-client/sessions";
import type { SessionView } from "@/lib/types/sessions";

import { ScheduleSessionButton } from "./schedule-session-button";
import { SessionCard } from "./session-card";

// The Sessions tab (F-30 step 4, SES-02): upcoming first, then past. Each card carries the buttons
// that fit its state. Times are shown in the viewer's time zone, with IST beside them elsewhere.

type Scope = "upcoming" | "past";
const EMPTY: Record<Scope, { title: string; description: string }> = {
  upcoming: {
    title: "No sessions coming up",
    description:
      "Use Schedule a session to pick a maker, or propose one from a profile, a conversation or a reply to your help request.",
  },
  past: {
    title: "No past sessions yet",
    description: "Completed, declined and cancelled sessions show here.",
  },
};

export function SessionsView({
  initialUpcoming,
}: {
  initialUpcoming: { items: SessionView[]; nextCursor: string | null };
}) {
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<Scope>("upcoming");
  const query = useInfiniteQuery({
    queryKey: ["sessions", scope],
    queryFn: ({ pageParam }) => listSessions(scope, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    ...(scope === "upcoming"
      ? { initialData: { pages: [initialUpcoming], pageParams: [null] }, staleTime: 30_000 }
      : { staleTime: 0 }),
  });
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  // Proposals waiting for your answer come first, so nobody has to hunt for them.
  const needsAnswer = scope === "upcoming" ? items.filter((session) => session.canRespond) : [];
  const rest = needsAnswer.length > 0 ? items.filter((session) => !session.canRespond) : items;

  function renderList(list: SessionView[]) {
    return (
      <ul className="grid gap-3 md:grid-cols-2">
        {list.map((session) => (
          <li key={session.id}>
            <SessionCard
              session={session}
              onChanged={() => void queryClient.invalidateQueries({ queryKey: ["sessions"] })}
            />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Show" className="flex flex-wrap gap-2">
          <ToggleChip pressed={scope === "upcoming"} onPressedChange={() => setScope("upcoming")}>
            Upcoming
          </ToggleChip>
          <ToggleChip pressed={scope === "past"} onPressedChange={() => setScope("past")}>
            Past
          </ToggleChip>
        </div>
        <ScheduleSessionButton />
      </div>

      {query.isPending ? (
        <div role="status" aria-label="Loading sessions" className="flex flex-col gap-3">
          {[0, 1].map((row) => (
            <Skeleton key={row} className="h-36 w-full" />
          ))}
        </div>
      ) : query.isError && items.length === 0 ? (
        <ErrorState
          message="We couldn't load your sessions."
          onRetry={() => void query.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<CalendarClock />}
          title={EMPTY[scope].title}
          description={EMPTY[scope].description}
        />
      ) : (
        <>
          {needsAnswer.length > 0 ? (
            <section aria-labelledby="needs-answer" className="flex flex-col gap-3">
              <h2 id="needs-answer" className="text-section text-foreground">
                Needs your answer
              </h2>
              {renderList(needsAnswer)}
            </section>
          ) : null}
          {rest.length > 0 ? (
            <section aria-label={needsAnswer.length > 0 ? "Other sessions" : undefined}>
              {renderList(rest)}
            </section>
          ) : null}
        </>
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
