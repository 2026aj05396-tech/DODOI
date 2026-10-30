"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Ban, CalendarPlus, EyeOff, Flag, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DropdownMenu } from "radix-ui";
import { useCallback, useEffect, useRef, useState } from "react";

import { ConfirmDeleteDialog } from "@/components/companion/confirm-delete-dialog";
import { Avatar } from "@/components/profile/avatar";
import { ReportDialog } from "@/components/reports/report-button";
import { BlockDialog } from "@/components/safety/block-dialog";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { showToast } from "@/components/ui/toast";
import {
  deleteMessage,
  hideConversation,
  listMessages,
  sendMessage,
} from "@/lib/api-client/messages";
import { ApiRequestError } from "@/lib/api-client/request";
import { MESSAGE_MAX } from "@/lib/schemas/messages";
import type { ConversationDetail, MessageView } from "@/lib/types/messages";
import { cn } from "@/lib/utils/cn";

import { MessageBubble } from "./message-bubble";

// One conversation (F-29 step 2–3, MSG-01…05): the person, the messages oldest first, a text field.
// It asks for newer messages every 10 seconds while the tab is visible. There are no "seen" marks.

const POLL_MS = 10_000;
const MENU_ITEM =
  "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-sm px-3 text-control text-foreground outline-none data-highlighted:bg-muted";

function messageOf(caught: unknown, fallback: string): string {
  return caught instanceof ApiRequestError ? caught.message : fallback;
}

function mergeById(current: MessageView[], incoming: MessageView[]): MessageView[] {
  const known = new Set(current.map((message) => message.id));
  const fresh = incoming.filter((message) => !known.has(message.id));
  return fresh.length > 0 ? [...current, ...fresh] : current;
}

export function ConversationView({
  initial,
  isVerified,
}: {
  initial: ConversationDetail;
  isVerified: boolean;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState(initial.messages);
  const [olderCursor, setOlderCursor] = useState(initial.olderCursor);
  const [canSend, setCanSend] = useState(initial.canSend);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<MessageView | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [dialog, setDialog] = useState<"hide" | "report-person" | "block" | null>(null);
  const [reporting, setReporting] = useState<MessageView | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const lastCursorRef = useRef<string | null>(initial.messages.at(-1)?.cursor ?? null);
  const person = initial.with;
  const name = person?.displayName ?? "A maker";

  useEffect(() => {
    lastCursorRef.current = messages.at(-1)?.cursor ?? null;
  }, [messages]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  // Opening a conversation reads it, so the unread dots are asked again.
  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: ["conversations"] });
  }, [queryClient]);

  const poll = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    try {
      const page = await listMessages(initial.id, {
        after: lastCursorRef.current ?? undefined,
      });
      if (page.items.length > 0) {
        setMessages((current) => mergeById(current, page.items));
        void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      }
    } catch {
      // The next tick tries again; a failed poll is not worth a banner.
    }
  }, [initial.id, queryClient]);

  useEffect(() => {
    const timer = setInterval(() => void poll(), POLL_MS);
    return () => clearInterval(timer);
  }, [poll]);

  async function loadOlder() {
    if (!olderCursor) return;
    setIsLoadingOlder(true);
    try {
      const page = await listMessages(initial.id, { before: olderCursor });
      setMessages((current) => [...page.items, ...current]);
      setOlderCursor(page.olderCursor);
    } catch (caught) {
      showToast({ message: messageOf(caught, "We couldn't load earlier messages.") });
    } finally {
      setIsLoadingOlder(false);
    }
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || isSending) return;
    setIsSending(true);
    setError(null);
    try {
      const sent = await sendMessage(initial.id, { body });
      setMessages((current) => mergeById(current, [sent]));
      setDraft("");
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    } catch (caught) {
      if (caught instanceof ApiRequestError && caught.code === "MESSAGES_CLOSED") {
        setCanSend(false);
      }
      setError(messageOf(caught, "We couldn't send that. Try again."));
    } finally {
      setIsSending(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setIsBusy(true);
    try {
      await deleteMessage(deleting.id);
      setMessages((current) =>
        current.map((message) =>
          message.id === deleting.id ? { ...message, body: null, isDeleted: true } : message,
        ),
      );
      showToast({ message: "Message deleted" });
    } catch (caught) {
      showToast({ message: messageOf(caught, "We couldn't delete that.") });
    } finally {
      setIsBusy(false);
      setDeleting(null);
    }
  }

  async function confirmHide() {
    setIsBusy(true);
    try {
      await hideConversation(initial.id);
      await queryClient.invalidateQueries({ queryKey: ["conversations"] });
      showToast({ message: "Conversation hidden" });
      router.replace("/messages");
    } catch (caught) {
      setIsBusy(false);
      setDialog(null);
      showToast({ message: messageOf(caught, "We couldn't hide that.") });
    }
  }

  const composerNotice = !isVerified
    ? "Verify your email to send messages."
    : !canSend
      ? "This person isn't taking messages right now."
      : null;

  return (
    <section
      aria-label={`Conversation with ${name}`}
      className="flex h-dvh min-h-0 flex-1 flex-col bg-background max-md:fixed max-md:inset-0 max-md:z-50"
    >
      <header className="flex flex-none items-center gap-2 border-b border-border px-4 py-2 md:px-5">
        <Link
          href="/messages"
          aria-label="Back to messages"
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-muted xl:hidden"
        >
          <ArrowLeft aria-hidden className="size-5" strokeWidth={1.9} />
        </Link>
        <Avatar url={person?.avatarUrl ?? null} className="size-9 shrink-0" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-section text-foreground">
            {person ? (
              <Link href={`/u/${person.username}`} className="hover:underline">
                {name}
              </Link>
            ) : (
              name
            )}
          </h2>
        </div>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger
            aria-label="More options for this conversation"
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-muted"
          >
            <MoreHorizontal aria-hidden className="size-5" />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={4}
              className="z-50 min-w-56 rounded-md border border-border bg-background p-1 shadow-float"
            >
              <DropdownMenu.Item className={MENU_ITEM} onSelect={() => setDialog("hide")}>
                <EyeOff aria-hidden className="size-4.5" />
                Hide conversation
              </DropdownMenu.Item>
              {person ? (
                <>
                  <DropdownMenu.Item asChild className={MENU_ITEM}>
                    <Link href={`/community/sessions/new?with=${person.username}`}>
                      <CalendarPlus aria-hidden className="size-4.5" />
                      Propose a session
                    </Link>
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    className={MENU_ITEM}
                    onSelect={() => setDialog("report-person")}
                  >
                    <Flag aria-hidden className="size-4.5" />
                    Report @{person.username}
                  </DropdownMenu.Item>
                  <DropdownMenu.Item className={MENU_ITEM} onSelect={() => setDialog("block")}>
                    <Ban aria-hidden className="size-4.5" />
                    Block @{person.username}
                  </DropdownMenu.Item>
                </>
              ) : null}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </header>

      <div
        role="log"
        aria-live="polite"
        aria-label="Messages"
        className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 py-4 md:px-5"
      >
        {olderCursor ? (
          <Button
            variant="outline"
            size="sm"
            className="self-center"
            disabled={isLoadingOlder}
            onClick={() => void loadOlder()}
          >
            {isLoadingOlder ? "Loading…" : "Earlier messages"}
          </Button>
        ) : null}
        {messages.length === 0 ? (
          <p className="m-auto max-w-xs text-center text-body text-foreground-secondary">
            Say hello to {name}. Messages here are text only.
          </p>
        ) : null}
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            onDelete={() => setDeleting(message)}
            onReport={() => setReporting(message)}
          />
        ))}
        <div ref={logEndRef} />
      </div>

      <form
        method="post"
        onSubmit={send}
        className="flex flex-none flex-col gap-2 border-t border-border px-4 py-3 md:px-5"
      >
        {error ? <ErrorBanner>{error}</ErrorBanner> : null}
        {composerNotice ? (
          <p role="status" className="text-body text-foreground-secondary">
            {composerNotice}
          </p>
        ) : (
          <div className="flex items-end gap-2">
            <label htmlFor="message-field" className="sr-only">
              Message to {name}
            </label>
            <textarea
              id="message-field"
              value={draft}
              rows={1}
              maxLength={MESSAGE_MAX}
              placeholder="Write a message"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              className={cn(
                "max-h-32 min-h-11 flex-1 resize-none rounded-md border-control border-input bg-background px-3.5 py-2.5 text-control-lg text-foreground placeholder:text-muted-foreground",
              )}
            />
            <Button type="submit" disabled={isSending || draft.trim() === ""}>
              {isSending ? "Sending…" : "Send"}
            </Button>
          </div>
        )}
        {draft.length > MESSAGE_MAX * 0.8 ? (
          <p className="text-meta text-foreground-secondary">
            {draft.length} / {MESSAGE_MAX}
          </p>
        ) : null}
      </form>

      {deleting ? (
        <ConfirmDeleteDialog
          title="Delete this message?"
          description="It is erased for both of you and shows as “Message deleted”."
          confirmLabel="Delete message"
          isBusy={isBusy}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleting(null)}
        />
      ) : null}
      {dialog === "hide" ? (
        <ConfirmDeleteDialog
          title="Hide this conversation?"
          description={`It leaves your list. ${name} still has it, and a new message from them brings it back.`}
          confirmLabel="Hide conversation"
          isBusy={isBusy}
          onConfirm={() => void confirmHide()}
          onCancel={() => setDialog(null)}
        />
      ) : null}
      {dialog === "report-person" && person ? (
        <ReportDialog
          targetType="PROFILE"
          targetId={person.username}
          targetLabel="this person"
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog === "block" && person ? (
        <BlockDialog username={person.username} onClose={() => setDialog(null)} />
      ) : null}
      {reporting ? (
        <ReportDialog
          targetType="MESSAGE"
          targetId={reporting.id}
          targetLabel="this message"
          onClose={() => setReporting(null)}
        />
      ) : null}
    </section>
  );
}
