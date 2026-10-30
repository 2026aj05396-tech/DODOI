"use client";

import { MessageCircle, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Skeleton } from "@/components/ui/skeleton";
import { showToast } from "@/components/ui/toast";
import { deleteAIConversation, listAIConversations } from "@/lib/api-client/ai";
import { ApiRequestError } from "@/lib/api-client/request";
import type { AIConversationSummary } from "@/lib/types/ai";
import { cn } from "@/lib/utils/cn";
import { relativeDay } from "@/lib/utils/relative-day";

import { ConfirmDeleteDialog } from "./confirm-delete-dialog";

// Past chats (F-23 step 2, AIC-01): kept 30 days, reopen or delete. Phones and tablet show it as
// the page at `/companion`; from 1280px it is the left pane beside the open chat.

function chatTitle(chat: AIConversationSummary): string {
  return chat.title?.trim() || "Untitled chat";
}

export function ConversationList({ className }: { className?: string }) {
  const pathname = usePathname();
  const [chats, setChats] = useState<AIConversationSummary[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [deleting, setDeleting] = useState<AIConversationSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const page = await listAIConversations();
      setChats(page.items);
      setCursor(page.nextCursor);
      setError(null);
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : "We couldn't load your chats.");
    }
  }, []);

  // A new chat appears (or an old one moves up) when the address changes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads from the API on mount and when the open chat changes.
    void load();
  }, [load, pathname]);

  async function loadMore() {
    if (!cursor) return;
    setIsLoadingMore(true);
    try {
      const page = await listAIConversations(cursor);
      setChats((current) => [...(current ?? []), ...page.items]);
      setCursor(page.nextCursor);
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : "We couldn't load more chats.");
    } finally {
      setIsLoadingMore(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setIsDeleting(true);
    try {
      await deleteAIConversation(deleting.id);
      setChats((current) => current?.filter((chat) => chat.id !== deleting.id) ?? null);
      showToast({ message: "Chat deleted" });
      setDeleting(null);
    } catch (caught) {
      showToast({
        message:
          caught instanceof ApiRequestError ? caught.message : "We couldn't delete that chat.",
      });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <nav
      aria-label="Your chats"
      className={cn(
        "flex flex-col gap-4 px-5 pt-4 pb-8 md:px-7 md:pt-8 xl:px-5 xl:pt-8",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-title text-foreground md:text-title-web xl:text-title">Companion</h1>
        <Button asChild size="sm">
          <Link href="/companion/new">
            <Plus aria-hidden className="size-4" strokeWidth={2.2} />
            New chat
          </Link>
        </Button>
      </div>
      <p className="text-meta text-foreground-secondary">
        Chats are kept for 30 days. You can delete one any time.
      </p>

      {error ? <ErrorBanner>{error}</ErrorBanner> : null}

      {chats === null && !error ? (
        <div role="status" aria-label="Loading your chats" className="flex flex-col gap-2">
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="h-18 w-full" />
          ))}
        </div>
      ) : null}

      {chats?.length === 0 ? (
        <EmptyState
          icon={<MessageCircle />}
          title="No chats yet"
          description="Ask about a craft, a technique or what to try next."
        />
      ) : null}

      {chats && chats.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {chats.map((chat) => {
            const isActive = pathname === `/companion/${chat.id}`;
            return (
              <li key={chat.id} className="flex items-center gap-1">
                <Link
                  href={`/companion/${chat.id}`}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex min-h-16 min-w-0 flex-1 flex-col justify-center gap-0.5 rounded-card border px-4 py-2.5",
                    isActive
                      ? "border-foreground bg-lavender"
                      : "border-border bg-background hover:bg-muted",
                  )}
                >
                  <span className="truncate text-control-lg font-bold text-foreground">
                    {chatTitle(chat)}
                  </span>
                  <span className="truncate text-meta text-foreground-secondary">
                    {chat.context ? `${chat.context.title} · ` : ""}
                    {relativeDay(chat.updatedAt)}
                  </span>
                </Link>
                <button
                  type="button"
                  aria-label={`Delete chat: ${chatTitle(chat)}`}
                  onClick={() => setDeleting(chat)}
                  className="flex size-11 shrink-0 items-center justify-center rounded-full text-foreground-secondary hover:bg-muted"
                >
                  <Trash2 aria-hidden className="size-4.5" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {cursor ? (
        <Button variant="outline" onClick={() => void loadMore()} disabled={isLoadingMore}>
          {isLoadingMore ? "Loading…" : "Show more"}
        </Button>
      ) : null}

      {deleting ? (
        <ConfirmDeleteDialog
          title="Delete this chat?"
          description="The chat and any photos in it are deleted for good. This can't be undone."
          confirmLabel="Delete chat"
          isBusy={isDeleting}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleting(null)}
        />
      ) : null}
    </nav>
  );
}
