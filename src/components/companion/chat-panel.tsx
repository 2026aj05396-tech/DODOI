"use client";

import { ArrowLeft, ArrowRight, ExternalLink, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { useIsOnline } from "@/hooks/use-is-online";
import { createAIPlan, sendAIMessage, updateAIConsents } from "@/lib/api-client/ai";
import { ApiRequestError } from "@/lib/api-client/request";
import { AI_TEXT_MAX_LENGTH, type AIContextInput } from "@/lib/schemas/ai";
import type { AIContextView, AIMessageView, AIPlan, CompanionSetup } from "@/lib/types/ai";
import { cn } from "@/lib/utils/cn";

import { AssistantBubble, BlockedNote, UserBubble } from "./message-bubble";
import { PlanCard } from "./plan-card";
import { PlanSheet } from "./plan-sheet";
import { ProfileConsentSheet } from "./profile-consent-sheet";
import { TypingIndicator } from "./typing-indicator";

// The companion chat (P4-02; designs `1f` mobile and `2c` docked; PRODUCT_REQUIREMENTS AIC-01…06,
// USER_FLOWS F-23). One panel serves the full page and the docked column. One answer at a time,
// with a typing indicator (no streaming, PO 2026-10-29).

const FREE_TIER_NOTICE =
  "Test version: Google may read your questions and photos. Don't share anything personal.";
const SUGGESTION = "What should I try next?";
const CHIP =
  "min-h-11 rounded-full border border-border-strong bg-background px-4 text-control text-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-60";
const RESTING = "The companion is resting. Try again later.";
/** A limit that resets within this many seconds is the per-minute one, not the daily one. */
const MINUTE_LIMIT_SECONDS = 90;

export type ChatPanelProps = {
  setup: CompanionSetup;
  isVerified: boolean;
  /** An existing conversation, or null to start one. */
  conversationId: string | null;
  initialMessages: AIMessageView[];
  /** The post or skill in view (`Looking at` / `Talking about`); fixed for the conversation. */
  context: AIContextView;
  /** What a new conversation is about; sent with the first message only. */
  newContext?: AIContextInput | null;
  /** Text waiting in the field, e.g. the skill page's question. */
  initialDraft?: string;
  /** `page` is the full screen (`1f`); `dock` is the right column on post and skill pages (`2c`). */
  variant: "page" | "dock";
  /** Where Back goes on the full-screen page. */
  backHref?: string;
  /** Called with the new conversation's id after its first answer. */
  onConversationStart?: (id: string) => void;
};

function formatResetTime(iso: string | undefined): string | null {
  if (!iso) return null;
  const time = new Date(iso);
  if (Number.isNaN(time.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(time);
}

/** Posts open at `/p/{id}`; a skill's link needs its slug, which only dodoi's own skills have here. */
function contextHref(context: NonNullable<AIContextView>, skills: CompanionSetup["skills"]) {
  if (context.type === "POST") return `/p/${context.id}`;
  const skill = skills.find((candidate) => candidate.name === context.title);
  return skill ? `/s/${skill.slug}` : null;
}

export function ChatPanel({
  setup,
  isVerified,
  conversationId: initialConversationId,
  initialMessages,
  context,
  newContext = null,
  initialDraft = "",
  variant,
  backHref = "/companion",
  onConversationStart,
}: ChatPanelProps) {
  const isOnline = useIsOnline();
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState(initialDraft);
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dailyLimit, setDailyLimit] = useState<string | null>(null);
  const [hasProfileConsent, setHasProfileConsent] = useState(setup.consents.AI_PROFILE_CONTEXT);
  const [isAskingConsent, setIsAskingConsent] = useState(false);
  const [isPlanFormOpen, setIsPlanFormOpen] = useState(false);
  const [isPlanning, setIsPlanning] = useState(false);
  // Plans live in this view only; `after` is how many messages came before each one.
  const [plans, setPlans] = useState<{ key: number; plan: AIPlan; after: number }[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const isPending = pendingText !== null || isPlanning;

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages, pendingText, notice, plans, isPlanning]);

  // The field keeps focus after sending (accessibility, UI_UX_GUIDELINES §8.2).
  useEffect(() => {
    if (!isPending) fieldRef.current?.focus({ preventScroll: true });
  }, [isPending]);

  const stateNotice = !setup.isAvailable
    ? RESTING
    : !isVerified
      ? "Verify your email to ask dodoi."
      : null;
  const isFieldDisabled = stateNotice !== null || !isOnline || dailyLimit !== null;
  const placeholder = !isOnline
    ? "You're offline"
    : dailyLimit
      ? dailyLimit
      : variant === "dock"
        ? "Ask about this…"
        : "Ask about a technique…";

  /** Quota, refusal and other failures of a message or a plan (F-23 step 5). */
  function showError(caught: unknown, onBlocked: () => void) {
    if (!(caught instanceof ApiRequestError)) {
      setNotice("We couldn't send that. Try again.");
    } else if (caught.code === "AI_QUOTA") {
      const resetAt = caught.fields.resetAt;
      const seconds = resetAt ? (new Date(resetAt).getTime() - Date.now()) / 1000 : 0;
      const time = formatResetTime(resetAt);
      if (seconds > MINUTE_LIMIT_SECONDS) {
        setDailyLimit(
          time
            ? `You've used today's questions. They reset at ${time}.`
            : "You've used today's questions. They reset tomorrow.",
        );
      } else {
        setNotice("Slow down a little. Try again in a minute.");
      }
    } else if (caught.code === "AI_BLOCKED") {
      onBlocked();
      setNotice("I can't help with that one.");
    } else {
      setNotice(caught.message);
    }
  }

  async function makePlan(input: { text: string; skillId?: string }) {
    setIsPlanFormOpen(false);
    setNotice(null);
    setIsPlanning(true);
    try {
      const plan = await createAIPlan(input);
      setPlans((current) => [...current, { key: current.length, plan, after: messages.length }]);
    } catch (caught) {
      showError(caught, () => undefined);
    } finally {
      setIsPlanning(false);
    }
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isPending || isFieldDisabled) return;
    setNotice(null);
    setPendingText(trimmed);
    setDraft("");
    try {
      const result = await sendAIMessage({
        text: trimmed,
        ...(conversationId ? { conversationId } : newContext ? { context: newContext } : {}),
      });
      setMessages((current) => [...current, result.userMessage, result.assistantMessage]);
      if (!conversationId) {
        setConversationId(result.conversation.id);
        onConversationStart?.(result.conversation.id);
      }
    } catch (caught) {
      setDraft(trimmed);
      showError(caught, () => setDraft(""));
    } finally {
      setPendingText(null);
    }
  }

  function startSuggestion() {
    if (hasProfileConsent) {
      void send(SUGGESTION);
    } else {
      setIsAskingConsent(true);
    }
  }

  async function answerConsent(allow: boolean) {
    setIsAskingConsent(false);
    if (allow) {
      try {
        await updateAIConsents({ AI_PROFILE_CONTEXT: true });
        setHasProfileConsent(true);
      } catch (caught) {
        setNotice(
          caught instanceof ApiRequestError ? caught.message : "We couldn't save that. Try again.",
        );
        return;
      }
    }
    // "Not now" still asks the question, without the member's interests.
    void send(SUGGESTION);
  }

  function resize(element: HTMLTextAreaElement) {
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 128)}px`;
  }

  const plansAfter = (count: number) =>
    plans
      .filter((entry) => entry.after === count)
      .map((entry) => <PlanCard key={`plan-${entry.key}`} plan={entry.plan} />);
  const isEmpty = messages.length === 0 && plans.length === 0 && !isPending;
  const showCounter = draft.length > AI_TEXT_MAX_LENGTH * 0.8;
  const contextLink = context ? contextHref(context, setup.skills) : null;

  return (
    <section
      aria-label="dodoi companion"
      className={cn(
        "flex min-h-0 flex-1 flex-col bg-ai-paper",
        variant === "page" && "h-dvh max-md:fixed max-md:inset-0 max-md:z-50",
        variant === "dock" && "h-full",
      )}
    >
      <header className="flex flex-none flex-col gap-1 border-b border-border px-4 pt-2 pb-3 md:px-5">
        <div className="flex items-center gap-2">
          {variant === "page" ? (
            <Link
              href={backHref}
              aria-label="Back"
              className="flex size-11 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-muted xl:hidden"
            >
              <ArrowLeft aria-hidden className="size-5" strokeWidth={1.9} />
            </Link>
          ) : null}
          <div className="flex min-w-0 flex-1 flex-col pt-1.5 xl:pt-3">
            <h2 className="flex items-center gap-1.5 text-section text-foreground">
              {variant === "dock" ? (
                <Sparkles aria-hidden className="size-4 fill-plum text-plum" />
              ) : null}
              dodoi companion
            </h2>
            {context ? (
              <p className="truncate text-meta text-foreground-secondary">
                {variant === "dock" ? "Talking about" : "Looking at"}:{" "}
                {contextLink ? (
                  <Link href={contextLink} className="hover:underline">
                    {context.title}
                  </Link>
                ) : (
                  context.title
                )}
              </p>
            ) : null}
          </div>
          {variant === "dock" && conversationId ? (
            <Link
              href={`/companion/${conversationId}`}
              aria-label="Open in full chat"
              className="flex size-11 shrink-0 items-center justify-center rounded-full text-foreground-secondary hover:bg-muted"
            >
              <ExternalLink aria-hidden className="size-4.5" />
            </Link>
          ) : null}
        </div>
        {setup.showFreeTierNotice ? (
          <p className="text-meta text-foreground-secondary">{FREE_TIER_NOTICE}</p>
        ) : null}
      </header>

      <div
        role="log"
        aria-live="polite"
        aria-label="Conversation"
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4 md:px-5"
      >
        {isEmpty ? (
          <div className="m-auto flex max-w-xs flex-col items-center gap-4 py-8 text-center">
            <Sparkles aria-hidden className="size-7 fill-plum text-plum" />
            <p className="text-section text-foreground">
              {context
                ? "Ask me anything about this."
                : "Ask me about a craft, a technique or what to try next"}
            </p>
            <button
              type="button"
              onClick={startSuggestion}
              disabled={isFieldDisabled}
              className={CHIP}
            >
              {SUGGESTION}
            </button>
          </div>
        ) : null}
        {plansAfter(0)}
        {messages.map((message, index) => (
          <div key={message.id} className="contents">
            {message.role === "USER" ? (
              <>
                <UserBubble message={message} />
                {message.status === "BLOCKED" ? <BlockedNote /> : null}
              </>
            ) : message.status === "OK" ? (
              <AssistantBubble message={message} skills={setup.skills} />
            ) : null}
            {plansAfter(index + 1)}
          </div>
        ))}
        {isPlanning ? <TypingIndicator /> : null}
        {pendingText !== null ? (
          <>
            <p className="max-w-[85%] self-end rounded-2xl rounded-br-sm bg-primary px-3.5 py-2.5 text-body-lg wrap-break-word whitespace-pre-line text-primary-foreground">
              {pendingText}
            </p>
            <TypingIndicator />
          </>
        ) : null}
        <div ref={logEndRef} />
      </div>

      <div className="flex flex-none flex-col gap-2 border-t border-border bg-background px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-5">
        {notice ? <ErrorBanner>{notice}</ErrorBanner> : null}
        {stateNotice ? (
          <p className="text-control-sm text-foreground-secondary">{stateNotice}</p>
        ) : null}
        <div>
          <button
            type="button"
            onClick={() => setIsPlanFormOpen(true)}
            disabled={isFieldDisabled || isPending}
            className={cn(CHIP, "min-h-9 px-3.5 text-control-sm")}
          >
            Plan a project
          </button>
        </div>
        <form
          method="post"
          onSubmit={(event) => {
            event.preventDefault();
            void send(draft);
          }}
          className="flex items-end gap-2"
        >
          <label htmlFor={`${variant}-companion-field`} className="sr-only">
            Your question
          </label>
          <textarea
            id={`${variant}-companion-field`}
            ref={fieldRef}
            rows={1}
            value={draft}
            maxLength={AI_TEXT_MAX_LENGTH}
            disabled={isFieldDisabled}
            placeholder={placeholder}
            onChange={(event) => {
              setDraft(event.target.value);
              resize(event.target);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                void send(draft);
              }
            }}
            className="max-h-32 min-h-11 flex-1 resize-none rounded-3xl border-control border-input bg-background px-4 py-2.5 text-body-lg text-foreground placeholder:text-foreground-secondary disabled:bg-muted"
          />
          <Button
            type="submit"
            aria-label="Send"
            disabled={isFieldDisabled || isPending || draft.trim() === ""}
            className="size-11 shrink-0 p-0"
          >
            <ArrowRight aria-hidden className="size-4.5" strokeWidth={2} />
          </Button>
        </form>
        {showCounter ? (
          <p className="text-right text-meta text-foreground-secondary">
            {draft.length} / {AI_TEXT_MAX_LENGTH}
          </p>
        ) : null}
      </div>

      {isPlanFormOpen ? (
        <PlanSheet
          skills={setup.skills}
          onSubmit={(input) => void makePlan(input)}
          onClose={() => setIsPlanFormOpen(false)}
        />
      ) : null}
      {isAskingConsent ? (
        <ProfileConsentSheet
          showFreeTierNotice={setup.showFreeTierNotice}
          onAnswer={(allow) => void answerConsent(allow)}
        />
      ) : null}
    </section>
  );
}
