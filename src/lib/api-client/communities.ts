import type {
  CommunityModerationInput,
  CreateCommunityInput,
  CreateCommunityPostInput,
} from "@/lib/schemas/communities";
import type { Paginated } from "@/lib/types/api";
import type {
  CommunityCard,
  CommunityDetail,
  CommunityManageView,
  CommunityPostView,
  CommunityThread,
} from "@/lib/types/communities";

import { postJson, requestJson } from "./request";

// Communities (API_SPECIFICATION §9.3, P3-01).

export type CommunityListFilter = { q?: string; mine?: boolean; cursor?: string | null };

export function listCommunities(filter: CommunityListFilter): Promise<Paginated<CommunityCard>> {
  const params = new URLSearchParams();
  if (filter.q) params.set("q", filter.q);
  if (filter.mine) params.set("mine", "true");
  if (filter.cursor) params.set("cursor", filter.cursor);
  const query = params.size > 0 ? `?${params}` : "";
  return requestJson<Paginated<CommunityCard>>("GET", `/api/communities${query}`);
}

export function createCommunity(
  input: Omit<CreateCommunityInput, "rules"> & { rules?: string[] },
): Promise<CommunityDetail> {
  return postJson<CommunityDetail>("/api/communities", input);
}

export function getCommunity(slug: string): Promise<CommunityDetail> {
  return requestJson<CommunityDetail>("GET", `/api/communities/${slug}`);
}

export function deleteCommunity(slug: string): Promise<void> {
  return requestJson("DELETE", `/api/communities/${slug}`);
}

export function joinCommunity(slug: string): Promise<void> {
  return requestJson("PUT", `/api/communities/${slug}/membership`);
}

export function leaveCommunity(slug: string): Promise<void> {
  return requestJson("DELETE", `/api/communities/${slug}/membership`);
}

export function listCommunityPosts(
  slug: string,
  cursor: string | null,
): Promise<Paginated<CommunityThread>> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return requestJson<Paginated<CommunityThread>>("GET", `/api/communities/${slug}/posts${query}`);
}

export function createCommunityPost(
  slug: string,
  input: Omit<CreateCommunityPostInput, "mediaIds"> & { mediaIds?: string[] },
): Promise<CommunityPostView> {
  return postJson<CommunityPostView>(`/api/communities/${slug}/posts`, input);
}

export function updateCommunityPost(id: string, body: string): Promise<CommunityPostView> {
  return requestJson<CommunityPostView>("PATCH", `/api/community-posts/${id}`, { body });
}

export function deleteCommunityPost(id: string): Promise<void> {
  return requestJson("DELETE", `/api/community-posts/${id}`);
}

export function moderateCommunity(slug: string, input: CommunityModerationInput): Promise<void> {
  return postJson<void>(`/api/communities/${slug}/moderation`, input);
}

export function getCommunityManageView(slug: string): Promise<CommunityManageView> {
  return requestJson<CommunityManageView>("GET", `/api/communities/${slug}/moderation-log`);
}
