"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Avatar } from "@/components/profile/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { SearchField } from "@/components/ui/search-field";
import { Skeleton } from "@/components/ui/skeleton";
import { showToast } from "@/components/ui/toast";
import { useDebounced } from "@/hooks/use-debounced";
import { listMessagePeople, startConversation } from "@/lib/api-client/messages";
import { ApiRequestError } from "@/lib/api-client/request";
import type { MessagePerson } from "@/lib/types/messages";

// "New message" (F-29 step 1b, MSG-06): search the members you can message, or pick one of the
// suggestions (people you follow and who follow you), and open the conversation. The server decides
// who is listed; a person who can't be messaged simply isn't there.

const SEARCH_DELAY_MS = 300;

export function NewMessagePanel({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [openingUsername, setOpeningUsername] = useState<string | null>(null);
  const q = useDebounced(search.trim(), SEARCH_DELAY_MS);
  const isSearching = q.length > 0;

  const people = useInfiniteQuery({
    queryKey: ["conversations", "people", q],
    queryFn: ({ pageParam }) => listMessagePeople(q, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    staleTime: 30_000,
  });
  const items = people.data?.pages.flatMap((page) => page.items) ?? [];
  // Typing again clears the list until the new answer arrives, so it never shows stale people.
  const isWaiting = people.isPending || search.trim() !== q;

  async function open(person: MessagePerson) {
    if (person.conversationId) {
      router.push(`/messages/${person.conversationId}`);
      onClose();
      return;
    }
    setOpeningUsername(person.username);
    try {
      const { id } = await startConversation(person.username);
      router.push(`/messages/${id}`);
      onClose();
    } catch (caught) {
      setOpeningUsername(null);
      showToast({
        message:
          caught instanceof ApiRequestError ? caught.message : "We couldn't open that. Try again.",
      });
    }
  }

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent layout="sheet" className="min-h-[60dvh] md:min-h-0">
        <DialogTitle>New message</DialogTitle>
        <DialogDescription className="sr-only">
          Search for a maker you can message, or pick one of the suggestions.
        </DialogDescription>
        <SearchField
          label="Search people"
          appearance="outline"
          placeholder="Search by name or @username"
          value={search}
          autoFocus
          maxLength={100}
          onChange={(event) => setSearch(event.target.value)}
        />

        <div className="flex flex-col gap-2" aria-live="polite">
          {!isSearching && !isWaiting && items.length > 0 ? (
            <h3 className="text-meta font-bold text-foreground-secondary">Suggested</h3>
          ) : null}

          {isWaiting ? (
            <div role="status" aria-label="Loading people" className="flex flex-col gap-2">
              {[0, 1, 2].map((row) => (
                <Skeleton key={row} className="h-14 w-full" />
              ))}
            </div>
          ) : people.isError ? (
            <ErrorState
              message="We couldn't load people."
              onRetry={() => void people.refetch()}
            />
          ) : items.length === 0 ? (
            <EmptyState
              icon={<Users />}
              title={isSearching ? "No one found that you can message" : "Search for a maker"}
              description={
                isSearching
                  ? "Try another name or username."
                  : "Type a name or username. People you follow will show up here."
              }
            />
          ) : (
            <ul className="flex flex-col gap-1">
              {items.map((person) => (
                <li key={person.username}>
                  <button
                    type="button"
                    disabled={openingUsername !== null}
                    onClick={() => void open(person)}
                    className="flex min-h-14 w-full items-center gap-3 rounded-card px-2 py-1.5 text-left hover:bg-muted disabled:opacity-60"
                  >
                    <Avatar url={person.avatarUrl} className="size-10 shrink-0" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-control-lg font-medium text-foreground">
                        {person.displayName}
                      </span>
                      <span className="truncate text-meta text-foreground-secondary">
                        {openingUsername === person.username ? "Opening…" : `@${person.username}`}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {people.hasNextPage && !isWaiting ? (
            <Button
              variant="outline"
              disabled={people.isFetchingNextPage}
              onClick={() => void people.fetchNextPage()}
            >
              {people.isFetchingNextPage ? "Loading…" : "Show more"}
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
