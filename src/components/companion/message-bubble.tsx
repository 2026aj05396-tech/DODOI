"use client";

import { Flag, ThumbsDown, ThumbsUp } from "lucide-react";
import { useState } from "react";

import { ReportDialog } from "@/components/reports/report-button";
import { sendAIFeedback } from "@/lib/api-client/ai";
import { ApiRequestError } from "@/lib/api-client/request";
import type { AIMessageView, CompanionSetup } from "@/lib/types/ai";
import { cn } from "@/lib/utils/cn";

import { AnswerText } from "./answer-text";

// Chat bubbles (design `1f`, `2c`): the member's on the right in coral; the companion's on the left
// with an AI label, "Answers can be wrong" (AIC-06), Helpful / Not helpful and Report.

const ACTION =
  "flex min-h-11 items-center gap-1.5 rounded-full px-3 text-control-sm text-foreground-secondary hover:bg-muted aria-pressed:bg-lavender aria-pressed:font-bold aria-pressed:text-foreground";

export function UserBubble({ message }: { message: AIMessageView }) {
  return (
    <div className="flex max-w-[85%] flex-col items-end gap-1.5 self-end">
      {message.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- Cloudinary serves the sizes in srcSet.
        <img
          src={message.image.url}
          srcSet={message.image.srcSet}
          sizes="170px"
          alt={message.image.altText ?? "The photo you added"}
          className="h-32.5 w-42.5 rounded-xl object-cover"
        />
      ) : null}
      <p className="rounded-2xl rounded-br-sm bg-primary px-3.5 py-2.5 text-body-lg wrap-break-word whitespace-pre-line text-primary-foreground">
        {message.content}
      </p>
    </div>
  );
}

export function AssistantBubble({
  message,
  skills,
}: {
  message: AIMessageView;
  skills: CompanionSetup["skills"];
}) {
  const [helpful, setHelpful] = useState<boolean | null>(message.feedback?.helpful ?? null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [isReporting, setIsReporting] = useState(false);

  async function rate(value: boolean) {
    const previous = helpful;
    setHelpful(value);
    setFeedbackError(null);
    try {
      await sendAIFeedback(message.id, { helpful: value });
    } catch (caught) {
      setHelpful(previous);
      setFeedbackError(
        caught instanceof ApiRequestError ? caught.message : "We couldn't save that. Try again.",
      );
    }
  }

  return (
    <div className="flex max-w-[92%] flex-col gap-1 self-start">
      <div className="flex flex-col gap-2.5 rounded-2xl rounded-bl-sm border border-border bg-background p-3.5 text-body-lg text-foreground">
        <span className="w-fit rounded-xs bg-lavender px-1.5 py-0.5 text-overline font-bold text-plum uppercase">
          AI
        </span>
        <AnswerText text={message.content} skills={skills} />
      </div>
      <p className="px-1 text-meta text-foreground-secondary">Answers can be wrong.</p>
      <div className="-ml-1 flex flex-wrap items-center">
        <button
          type="button"
          aria-pressed={helpful === true}
          onClick={() => void rate(true)}
          className={ACTION}
        >
          <ThumbsUp aria-hidden className="size-4" />
          Helpful
        </button>
        <button
          type="button"
          aria-pressed={helpful === false}
          onClick={() => void rate(false)}
          className={ACTION}
        >
          <ThumbsDown aria-hidden className="size-4" />
          Not helpful
        </button>
        <button type="button" onClick={() => setIsReporting(true)} className={ACTION}>
          <Flag aria-hidden className="size-4" />
          Report
        </button>
      </div>
      {feedbackError ? (
        <p role="alert" className="px-1 text-meta text-destructive">
          {feedbackError}
        </p>
      ) : null}
      {isReporting ? (
        <ReportDialog
          targetType="AI_MESSAGE"
          targetId={message.id}
          targetLabel="this answer"
          onClose={() => setIsReporting(false)}
        />
      ) : null}
    </div>
  );
}

/** A question the safety filter refused, kept in the history (F-23 step 5). */
export function BlockedNote({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "w-fit max-w-[92%] self-start rounded-2xl rounded-bl-sm bg-muted px-3.5 py-2.5 text-body text-foreground-secondary",
        className,
      )}
    >
      I can&apos;t help with that one.
    </p>
  );
}
