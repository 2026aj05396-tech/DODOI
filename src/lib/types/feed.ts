import type { HelpRequestCard } from "@/lib/types/help";
import type { Media } from "@/lib/types/media";
import type { PostCard } from "@/lib/types/posts";
import type { SkillSummary } from "@/lib/types/skills";

// Feed views returned by the API (API_SPECIFICATION §5).

/** The "New to you" card (FEED-14). */
export type SkillSuggestion = {
  kind: "skill_suggestion";
  skill: SkillSummary;
  pitch: string;
  /** Published beginner projects under an hour ("3 beginner projects under an hour"). */
  beginnerProjectCount: number;
  coverMedia: Media | null;
};

/** A help request in the feed (HLP-03): for skills the member can help with. */
export type HelpRequestFeedItem = { kind: "help_request"; request: HelpRequestCard };

export type FeedItem = { kind: "post"; post: PostCard } | SkillSuggestion | HelpRequestFeedItem;

export type FeedPage = { items: FeedItem[]; nextCursor: string | null };

/** A chip in the filter bar (FEED-13). */
export type FeedFilterChip = { key: string; label: string };
