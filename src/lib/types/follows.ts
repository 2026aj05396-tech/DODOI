import type { CreatorSummary } from "@/lib/types/posts";

// Follow views returned by the API (API_SPECIFICATION §9.1, P2-06).

/** Whether the viewer may follow a maker and does (creator row, profile header). */
export type FollowState = {
  /** False for yourself, private or hidden profiles (FLW-02); then no Follow button shows. */
  canFollow: boolean;
  isFollowing: boolean;
};

/** A person in the owner's Followers or Following list (FLW-03). */
export type FollowListItem = CreatorSummary;

export type FollowCounts = { followers: number; following: number };
