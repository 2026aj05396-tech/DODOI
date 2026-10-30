"use client";

import { useState } from "react";

import { ConfirmDeleteDialog } from "@/components/companion/confirm-delete-dialog";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { showToast } from "@/components/ui/toast";
import {
  deleteAIConversation,
  deleteAllAIConversations,
  listAIConversations,
  updateAIConsents,
} from "@/lib/api-client/ai";
import { ApiRequestError } from "@/lib/api-client/request";
import type { AIConsents, AIConversationSummary } from "@/lib/types/ai";
import type { Paginated } from "@/lib/types/api";
import { relativeDay } from "@/lib/utils/relative-day";

// Settings → AI and privacy (P4-07, AIC-07, AIC-08, F-26): the two consent switches, saved as soon
// as one changes and effective at once; the member's chats with Delete; Delete all (photos go too).

const SWITCHES: {
  type: keyof AIConsents;
  label: string;
  description: string;
}[] = [
  {
    type: "AI_IMAGES",
    label: "Use my photos in the companion",
    description:
      "A photo you add is sent to our AI provider with your question. Switching this off stops it at once; chats you already have stay until you delete them.",
  },
  {
    type: "AI_PROFILE_CONTEXT",
    label: "Use my interests and levels",
    description:
      "Your interests, levels and the skills you want to learn are sent with your questions so ideas fit you. Your collections and messages are never shared.",
  },
];

type Deleting = { kind: "one"; chat: AIConversationSummary } | { kind: "all" };

export function AiPrivacyForm({
  initialConsents,
  initialChats,
  showFreeTierNotice,
}: {
  initialConsents: AIConsents;
  initialChats: Paginated<AIConversationSummary>;
  showFreeTierNotice: boolean;
}) {
  const [consents, setConsents] = useState(initialConsents);
  const [chats, setChats] = useState(initialChats.items);
  const [cursor, setCursor] = useState(initialChats.nextCursor);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [deleting, setDeleting] = useState<Deleting | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  function messageOf(error: unknown, fallback: string): string {
    return error instanceof ApiRequestError ? error.message : fallback;
  }

  async function change(type: keyof AIConsents, granted: boolean) {
    setConsents((current) => ({ ...current, [type]: granted }));
    try {
      await updateAIConsents({ [type]: granted });
    } catch (error) {
      setConsents((current) => ({ ...current, [type]: !granted }));
      showToast({ message: messageOf(error, "We couldn't save that.") });
    }
  }

  async function loadMore() {
    if (!cursor) return;
    setIsLoadingMore(true);
    try {
      const page = await listAIConversations(cursor);
      setChats((current) => [...current, ...page.items]);
      setCursor(page.nextCursor);
    } catch (error) {
      showToast({ message: messageOf(error, "We couldn't load more chats.") });
    } finally {
      setIsLoadingMore(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setIsDeleting(true);
    try {
      if (deleting.kind === "all") {
        await deleteAllAIConversations();
        setChats([]);
        setCursor(null);
        showToast({ message: "All chats deleted" });
      } else {
        const { id } = deleting.chat;
        await deleteAIConversation(id);
        setChats((current) => current.filter((chat) => chat.id !== id));
        showToast({ message: "Chat deleted" });
      }
      setDeleting(null);
    } catch (error) {
      showToast({ message: messageOf(error, "We couldn't delete that.") });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {showFreeTierNotice ? (
        <p className="text-control-sm text-foreground-secondary">
          Test version: Google may read your questions and photos. Don&apos;t share anything
          personal.
        </p>
      ) : null}

      <section aria-labelledby="ai-switches" className="flex flex-col gap-3">
        <h2 id="ai-switches" className="text-section text-foreground">
          What the companion can use
        </h2>
        <ul className="flex flex-col divide-y divide-border rounded-card border border-border bg-background">
          {SWITCHES.map(({ type, label, description }) => (
            <li key={type}>
              <label className="flex min-h-16 cursor-pointer items-center gap-3.5 px-4 py-3">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-control-lg font-bold text-foreground">{label}</span>
                  <span className="text-meta text-foreground-secondary">{description}</span>
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={consents[type]}
                  onChange={(event) => void change(type, event.target.checked)}
                  className="size-5 shrink-0 accent-[var(--color-foreground)]"
                />
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="ai-chats" className="flex flex-col gap-3">
        <h2 id="ai-chats" className="text-section text-foreground">
          Your conversations
        </h2>
        <p className="text-meta text-foreground-secondary">
          Chats are kept for 30 days after the last message, then deleted. Photos go with them.
        </p>
        {chats.length === 0 ? (
          <EmptyState title="No conversations" description="Chats with the companion show here." />
        ) : (
          <>
            <ul className="flex flex-col divide-y divide-border rounded-card border border-border bg-background">
              {chats.map((chat) => (
                <li key={chat.id} className="flex items-center gap-2 px-4 py-2">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-control-lg font-bold text-foreground">
                      {chat.title?.trim() || "Untitled chat"}
                    </span>
                    <span className="truncate text-meta text-foreground-secondary">
                      {chat.context ? `${chat.context.title} · ` : ""}
                      {relativeDay(chat.updatedAt)}
                    </span>
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={`Delete chat: ${chat.title?.trim() || "Untitled chat"}`}
                    onClick={() => setDeleting({ kind: "one", chat })}
                  >
                    Delete
                  </Button>
                </li>
              ))}
            </ul>
            {cursor ? (
              <Button variant="outline" onClick={() => void loadMore()} disabled={isLoadingMore}>
                {isLoadingMore ? "Loading…" : "Show more"}
              </Button>
            ) : null}
            <Button
              variant="destructive"
              onClick={() => setDeleting({ kind: "all" })}
              className="self-start"
            >
              Delete all conversations
            </Button>
          </>
        )}
      </section>

      {deleting ? (
        <ConfirmDeleteDialog
          title={deleting.kind === "all" ? "Delete all conversations?" : "Delete this chat?"}
          description={
            deleting.kind === "all"
              ? "Every chat with the companion and the photos in them are deleted for good. This can't be undone."
              : "The chat and any photos in it are deleted for good. This can't be undone."
          }
          confirmLabel={deleting.kind === "all" ? "Delete all" : "Delete chat"}
          isBusy={isDeleting}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleting(null)}
        />
      ) : null}
    </div>
  );
}
