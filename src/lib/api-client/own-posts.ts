import type {
  CreateOwnPostInput,
  PublishOwnPostInput,
  UpdateOwnPostInput,
} from "@/lib/schemas/posts";
import type { Paginated } from "@/lib/types/api";
import type { OwnPost, PostCard } from "@/lib/types/posts";

import { postJson, requestJson } from "./request";

// The maker's own posts (API_SPECIFICATION §9.1, P2-02).

export function createOwnPost(input: Partial<CreateOwnPostInput>): Promise<OwnPost> {
  return postJson<OwnPost>("/api/me/posts", input);
}

export function updateOwnPost(id: string, input: UpdateOwnPostInput): Promise<OwnPost> {
  return requestJson<OwnPost>("PATCH", `/api/me/posts/${id}`, input);
}

export function publishOwnPost(id: string, input: PublishOwnPostInput): Promise<OwnPost> {
  return postJson<OwnPost>(`/api/me/posts/${id}/publish`, input);
}

export function deleteOwnPost(id: string): Promise<void> {
  return requestJson("DELETE", `/api/me/posts/${id}`);
}

/** A profile's published posts, newest first (Posts tab). */
export function getProfilePosts(
  username: string,
  cursor?: string | null,
): Promise<Paginated<PostCard>> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return requestJson<Paginated<PostCard>>("GET", `/api/profiles/${username}/posts${query}`);
}
