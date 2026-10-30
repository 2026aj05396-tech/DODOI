import type { CreatorSummary } from "@/lib/types/posts";

// Notification views returned by the API (API_SPECIFICATION §9.1, P2-07).

/** The types a member can switch off in Settings → Notifications (NTF-04). */
export type NotificationPreferenceName =
  "COMMENT" | "REPLY" | "FOLLOW" | "LIKE" | "HELP_RESPONSE" | "HELP_HELPFUL" | "HELP_RESOLVED";

/** Session notifications (P3-04, SES-04) are answers to things the member did, so they have no switch. */
export type SessionNotificationName =
  | "SESSION_PROPOSED"
  | "SESSION_ACCEPTED"
  | "SESSION_DECLINED"
  | "SESSION_RESCHEDULED"
  | "SESSION_CANCELLED"
  | "SESSION_REMINDER";

export type NotificationTypeName = NotificationPreferenceName | SessionNotificationName;

export type NotificationItem = {
  /** The newest notification of a group. */
  id: string;
  type: NotificationTypeName;
  /** Up to two people to name ("Asha and Ravi", "Ravi and 3 others"); empty if their profiles are gone. */
  actors: CreatorSummary[];
  /** Everyone in the group, including those not named. */
  actorCount: number;
  /** The post it is about; null for a new follower. */
  post: { id: string; title: string } | null;
  /** The help request it is about (P3-03), with its title; null for the other types. */
  helpRequest: { id: string; title: string } | null;
  /** The creative session it is about (P3-04): its start, shown in the viewer's time zone. */
  session: { id: string; startsAt: string } | null;
  /** The comment or reply, to scroll to. */
  commentId: string | null;
  isUnread: boolean;
  createdAt: string;
};

export type NotificationPreferences = Record<NotificationPreferenceName, boolean>;
