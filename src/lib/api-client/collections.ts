import type { Paginated } from "@/lib/types/api";
import type { CollectionVisibility } from "@/lib/types/collections";
import type { CollectionPage, CollectionSummary } from "@/lib/types/collections";
import type { PostCard } from "@/lib/types/posts";

import { requestJson } from "./request";

// Saves and collections (API_SPECIFICATION §6).

function pagePath(path: string, cursor?: string | null): string {
  return cursor ? `${path}?cursor=${encodeURIComponent(cursor)}` : path;
}

export function getSavedPosts(cursor?: string | null): Promise<Paginated<PostCard>> {
  return requestJson<Paginated<PostCard>>("GET", pagePath("/api/saves", cursor));
}

export async function getMyCollections(): Promise<CollectionSummary[]> {
  return (await requestJson<{ items: CollectionSummary[] }>("GET", "/api/collections")).items;
}

export function getCollectionPage(id: string, cursor?: string | null): Promise<CollectionPage> {
  return requestJson<CollectionPage>("GET", pagePath(`/api/collections/${id}`, cursor));
}

export function createCollection(
  name: string,
  visibility: CollectionVisibility = "PRIVATE",
): Promise<CollectionSummary> {
  return requestJson<CollectionSummary>("POST", "/api/collections", { name, visibility });
}

export function updateCollection(
  id: string,
  input: { name?: string; visibility?: CollectionVisibility },
): Promise<CollectionSummary> {
  return requestJson<CollectionSummary>("PATCH", `/api/collections/${id}`, input);
}

export function deleteCollection(id: string): Promise<void> {
  return requestJson("DELETE", `/api/collections/${id}`);
}

export function addToCollection(id: string, postId: string): Promise<void> {
  return requestJson("PUT", `/api/collections/${id}/items/${postId}`);
}

export function removeFromCollection(id: string, postId: string): Promise<void> {
  return requestJson("DELETE", `/api/collections/${id}/items/${postId}`);
}

export async function getCollectionIdsForPost(postId: string): Promise<string[]> {
  return (await requestJson<{ ids: string[] }>("GET", `/api/posts/${postId}/collections`)).ids;
}
