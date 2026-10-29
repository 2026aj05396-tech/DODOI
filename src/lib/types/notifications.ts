import type { CreatorSummary } from "@/lib/types/posts";

// Notification views returned by the API (API_SPECIFICATION §9.1, P2-07).

export type NotificationTypeName = "COMMENT" | "REPLY" | "FOLLOW" | "LIKE";

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
  /** The comment or reply, to scroll to. */
  commentId: string | null;
  isUnread: boolean;
  createdAt: string;
};

export type NotificationPreferences = Record<NotificationTypeName, boolean>;
