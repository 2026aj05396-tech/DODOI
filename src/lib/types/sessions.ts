import type { CreatorSummary } from "@/lib/types/posts";

// Creative session views returned by the API (API_SPECIFICATION §9.3, P3-04).

/** Completed is worked out from the end time, so a view never shows a session that ended as Accepted. */
export type SessionStateName =
  "PROPOSED" | "ACCEPTED" | "DECLINED" | "RESCHEDULED" | "CANCELLED" | "COMPLETED";

export type SessionView = {
  id: string;
  state: SessionStateName;
  /** You proposed it (so you wait for an answer) rather than being invited. */
  isProposer: boolean;
  /** The other person; null when their profile is hidden or gone. */
  other: CreatorSummary | null;
  startsAt: string;
  durationMin: number;
  note: string | null;
  /** Only for the two people, once accepted, and until 24 hours after the end (SES-05). */
  meetingUrl: string | null;
  helpRequestId: string | null;
  /** The invitee can answer a proposal that has not started yet. */
  canRespond: boolean;
  /** Either person, until the session ends. */
  canCancel: boolean;
  createdAt: string;
};
