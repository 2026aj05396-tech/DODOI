import type { Paginated } from "@/lib/types/api";
import type { FollowListItem } from "@/lib/types/follows";

import { requestJson } from "./request";

// Follows (API_SPECIFICATION §9.1, P2-06).

export function followUser(username: string): Promise<void> {
  return requestJson("PUT", `/api/follows/${encodeURIComponent(username)}`);
}

export function unfollowUser(username: string): Promise<void> {
  return requestJson("DELETE", `/api/follows/${encodeURIComponent(username)}`);
}

export function listFollows(
  list: "followers" | "following",
  cursor: string | null,
): Promise<Paginated<FollowListItem>> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return requestJson<Paginated<FollowListItem>>("GET", `/api/me/${list}${query}`);
}
