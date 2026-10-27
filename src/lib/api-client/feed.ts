import type { FeedFilter } from "@/lib/schemas/feed";
import type { FeedFilterChip, FeedPage, SkillSuggestion } from "@/lib/types/feed";

import { requestJson } from "./request";

// Home feed (API_SPECIFICATION §5).

export function getFeedPage(filter: FeedFilter, cursor?: string | null): Promise<FeedPage> {
  const params = new URLSearchParams({ filter });
  if (cursor) params.set("cursor", cursor);
  return requestJson<FeedPage>("GET", `/api/feed?${params}`);
}

export async function getFeedFilters(): Promise<FeedFilterChip[]> {
  return (await requestJson<{ items: FeedFilterChip[] }>("GET", "/api/feed/filters")).items;
}

/** The right-rail "New to you" card, or null (204). */
export async function getSkillSuggestion(): Promise<SkillSuggestion | null> {
  return (await requestJson<SkillSuggestion | undefined>("GET", "/api/feed/suggestion")) ?? null;
}

export function markNotInterested(postId: string): Promise<void> {
  return requestJson("POST", "/api/feed/feedback", { postId, type: "NOT_INTERESTED" });
}

export function undoNotInterested(postId: string): Promise<void> {
  return requestJson("DELETE", "/api/feed/feedback", { postId, type: "NOT_INTERESTED" });
}
