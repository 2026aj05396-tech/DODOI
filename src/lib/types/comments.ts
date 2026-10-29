import type { CreatorSummary } from "@/lib/types/posts";

// Comment views returned by the API (API_SPECIFICATION §9.1, P2-04).

export type Comment = {
  id: string;
  postId: string;
  /** Set on replies. */
  parentId: string | null;
  /** Null when the comment was deleted but has replies ("Comment deleted", CMT-02). */
  body: string | null;
  isDeleted: boolean;
  /** Null when deleted, or when the writer's profile is hidden or their account is gone. */
  author: CreatorSummary | null;
  createdAt: string;
  /** Set once the writer edited it ("edited"). */
  editedAt: string | null;
  isOwn: boolean;
  /** Hidden after a report; only its writer sees this, with "Hidden after a report" (MOD-04). */
  isHidden: boolean;
  /** Owner, or the post's author (CMT-03). */
  canDelete: boolean;
  /** Top-level comments only. */
  replyCount: number;
  /** Top-level comments only: the first replies, oldest first. */
  replies: Comment[];
};
