"use client";

import { Calendar, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ConfirmDeleteDialog } from "@/components/companion/confirm-delete-dialog";
import { Avatar } from "@/components/profile/avatar";
import { Button } from "@/components/ui/button";
import { showToast } from "@/components/ui/toast";
import { ApiRequestError } from "@/lib/api-client/request";
import { respondToSession } from "@/lib/api-client/sessions";
import type { SessionStateName, SessionView } from "@/lib/types/sessions";
import { cn } from "@/lib/utils/cn";
import { formatSessionTime } from "@/lib/utils/session-time";

import { RescheduleDialog } from "./reschedule-dialog";

// A session (UI_UX_GUIDELINES §8.3): the other person, the time in the viewer's zone with IST beside
// it elsewhere, the length, a status chip (dot and text, never colour alone), the note, the meeting
// link once accepted with its warning, and the buttons that fit the state and the viewer.

const STATE_LABEL: Record<SessionStateName, string> = {
  PROPOSED: "Proposed",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  RESCHEDULED: "New time suggested",
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
};
const STATE_DOT: Record<SessionStateName, string> = {
  PROPOSED: "bg-butter-strong",
  ACCEPTED: "bg-success",
  DECLINED: "bg-muted-foreground",
  RESCHEDULED: "bg-muted-foreground",
  CANCELLED: "bg-muted-foreground",
  COMPLETED: "bg-muted-foreground",
};

export function SessionCard({
  session,
  onChanged,
}: {
  session: SessionView;
  /** Called after an answer so the list reloads. */
  onChanged: () => void;
}) {
  const [isBusy, setIsBusy] = useState(false);
  const [isConfirmingCancel, setIsConfirmingCancel] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const { local, ist } = formatSessionTime(session.startsAt);
  const name = session.other?.displayName ?? "A maker";

  async function answer(action: "ACCEPT" | "DECLINE" | "CANCEL") {
    setIsBusy(true);
    try {
      await respondToSession(session.id, { action });
      showToast({
        message:
          action === "ACCEPT"
            ? "Session accepted"
            : action === "DECLINE"
              ? "Session declined"
              : "Session cancelled",
      });
      onChanged();
    } catch (caught) {
      showToast({
        message: caught instanceof ApiRequestError ? caught.message : "We couldn't do that.",
      });
    } finally {
      setIsBusy(false);
      setIsConfirmingCancel(false);
    }
  }

  const waiting = session.state === "PROPOSED" && session.isProposer;
  return (
    <article className="flex flex-col gap-3 rounded-card border border-border bg-background p-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <Avatar url={session.other?.avatarUrl ?? null} className="size-9 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-control-lg font-bold text-foreground">
            {session.other ? (
              <Link href={`/u/${session.other.username}`} className="hover:underline">
                {name}
              </Link>
            ) : (
              name
            )}
          </p>
          <p className="text-meta text-foreground-secondary">
            {session.isProposer ? "You proposed" : "Proposed to you"}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-meta font-bold text-foreground">
          <span aria-hidden className={cn("size-2 rounded-full", STATE_DOT[session.state])} />
          {STATE_LABEL[session.state]}
        </span>
      </div>

      <div className="flex items-start gap-2.5 text-body text-foreground">
        <Calendar aria-hidden className="mt-0.5 size-4.5 shrink-0 text-foreground-secondary" />
        <p>
          <time dateTime={session.startsAt} className="font-bold">
            {local}
          </time>
          {ist ? <span className="text-foreground-secondary"> · {ist}</span> : null}
          <span className="text-foreground-secondary"> · {session.durationMin} min</span>
        </p>
      </div>

      {session.note ? (
        <p className="text-body wrap-break-word whitespace-pre-line text-foreground">
          {session.note}
        </p>
      ) : null}

      {session.meetingUrl ? (
        <div className="flex flex-col gap-1.5 rounded-md bg-lavender p-3">
          <a
            href={session.meetingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-control-lg font-bold break-all text-link hover:underline"
          >
            <ExternalLink aria-hidden className="size-4 shrink-0" />
            Join the call
          </a>
          <p className="text-meta text-foreground">
            Opens another site. Only join if you&apos;re comfortable.
          </p>
        </div>
      ) : null}

      {waiting ? (
        <p className="text-meta text-foreground-secondary">Waiting for {name} to answer.</p>
      ) : null}

      {session.canRespond || session.canCancel ? (
        <div className="flex flex-wrap gap-2">
          {session.canRespond ? (
            <>
              <Button size="sm" disabled={isBusy} onClick={() => void answer("ACCEPT")}>
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={isBusy}
                onClick={() => void answer("DECLINE")}
              >
                Decline
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={isBusy}
                onClick={() => setIsRescheduling(true)}
              >
                Suggest another time
              </Button>
            </>
          ) : null}
          {session.canCancel ? (
            <Button
              size="sm"
              variant="text"
              className="text-destructive"
              disabled={isBusy}
              onClick={() => setIsConfirmingCancel(true)}
            >
              Cancel session
            </Button>
          ) : null}
        </div>
      ) : null}

      {isConfirmingCancel ? (
        <ConfirmDeleteDialog
          title="Cancel this session?"
          description={`${name} is told. The meeting link is removed from dodoi.`}
          confirmLabel="Cancel session"
          isBusy={isBusy}
          onConfirm={() => void answer("CANCEL")}
          onCancel={() => setIsConfirmingCancel(false)}
        />
      ) : null}
      {isRescheduling ? (
        <RescheduleDialog
          session={session}
          onClose={() => setIsRescheduling(false)}
          onDone={() => {
            setIsRescheduling(false);
            onChanged();
          }}
        />
      ) : null}
    </article>
  );
}
