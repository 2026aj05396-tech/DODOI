import type { SearchType } from "@/lib/schemas/search";
import type { Paginated } from "@/lib/types/api";
import type { PostCard, ThemeSummary } from "@/lib/types/posts";
import type { SearchAll, SearchResults } from "@/lib/types/search";

import { requestJson } from "./request";

// Search and themes (API_SPECIFICATION §5).

export function search(
  q: string,
  type: SearchType,
  cursor?: string | null,
): Promise<SearchResults> {
  const params = new URLSearchParams({ q, type });
  if (cursor) params.set("cursor", cursor);
  return requestJson<SearchResults>("GET", `/api/search?${params}`);
}

export function searchAll(q: string): Promise<SearchAll> {
  return search(q, "all") as Promise<SearchAll>;
}

export async function getThemePosts(slug: string, cursor?: string | null) {
  const params = new URLSearchParams(cursor ? { cursor } : {});
  const page = await requestJson<{ theme: ThemeSummary; posts: Paginated<PostCard> }>(
    "GET",
    `/api/themes/${slug}?${params}`,
  );
  return page.posts;
}
