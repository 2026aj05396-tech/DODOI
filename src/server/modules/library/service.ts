import "server-only";

import type {
  CreateCollectionInput,
  ListPageQuery,
  UpdateCollectionInput,
} from "@/lib/schemas/collections";
import type { Paginated } from "@/lib/types/api";
import type { CollectionPage, CollectionSummary, SaveResult } from "@/lib/types/collections";
import type { PostCard } from "@/lib/types/posts";
import { mediaProvider as defaultProvider, type MediaProvider } from "@/server/integrations/media";
import type { Actor } from "@/server/lib/actor";
import {
  addToCollection as addItem,
  createCollection as insertCollection,
  getCollectionPage as loadCollectionPage,
  listMyCollections,
  listSavedPostIds,
  savePost as save,
  updateCollection as changeCollection,
  type CollectionRow,
} from "@/server/modules/collections";
import { getPostCards, isPostPublished } from "@/server/modules/content";

// The user's library (COLL-01…07): saves and collections from the collections module, shown as
// post cards from the content module. It sits above both because content already depends on
// collections (the `isSaved` flag on cards), and module imports must not form a cycle.

type ProviderOption = { provider?: MediaProvider };

async function toSummaries(
  actor: Actor,
  rows: CollectionRow[],
  provider: MediaProvider,
): Promise<CollectionSummary[]> {
  const previewIds = [...new Set(rows.flatMap((row) => row.previewPostIds))];
  const covers = new Map(
    (await getPostCards(actor, previewIds, { provider })).map((card) => [card.id, card.coverMedia]),
  );
  return rows.map(({ previewPostIds, ...row }) => {
    const previewMedia = previewPostIds.flatMap((id) => covers.get(id) ?? []);
    return { ...row, coverMedia: previewMedia[0] ?? null, previewMedia };
  });
}

/** PUT /api/saves/{postId}. */
export async function savePost(actor: Actor, postId: string): Promise<SaveResult> {
  return save(actor, postId, isPostPublished);
}

/** GET /api/saves: "All saved", most recently saved first. */
export async function listSavedPosts(
  actor: Actor,
  query: ListPageQuery,
  { provider = defaultProvider }: ProviderOption = {},
): Promise<Paginated<PostCard>> {
  const page = await listSavedPostIds(actor, query);
  return {
    items: await getPostCards(actor, page.postIds, { provider }),
    nextCursor: page.nextCursor,
  };
}

/** GET /api/collections. */
export async function listCollections(
  actor: Actor,
  { provider = defaultProvider }: ProviderOption = {},
): Promise<CollectionSummary[]> {
  return toSummaries(actor, await listMyCollections(actor), provider);
}

/** POST /api/collections. */
export async function createCollection(
  actor: Actor,
  input: CreateCollectionInput,
): Promise<CollectionSummary> {
  const { previewPostIds: _previews, ...row } = await insertCollection(actor, input);
  return { ...row, coverMedia: null, previewMedia: [] };
}

/** PATCH /api/collections/{id}. */
export async function updateCollection(
  actor: Actor,
  id: string,
  input: UpdateCollectionInput,
  { provider = defaultProvider }: ProviderOption = {},
): Promise<CollectionSummary> {
  const [summary] = await toSummaries(actor, [await changeCollection(actor, id, input)], provider);
  if (!summary) throw new Error("Collection summary missing");
  return summary;
}

/** GET /api/collections/{id}. */
export async function getCollection(
  actor: Actor,
  id: string,
  query: ListPageQuery,
  { provider = defaultProvider }: ProviderOption = {},
): Promise<CollectionPage> {
  const page = await loadCollectionPage(actor, id, query);
  const { isOwner, owner, ...row } = page.collection;
  const [summary] = await toSummaries(actor, [row], provider);
  const items = await getPostCards(actor, page.postIds, { provider });
  if (!summary) throw new Error("Collection summary missing");
  return { collection: { ...summary, isOwner, owner }, items, nextCursor: page.nextCursor };
}

/** PUT /api/collections/{id}/items/{postId}: saves first if needed. */
export async function addToCollection(actor: Actor, id: string, postId: string): Promise<void> {
  await addItem(actor, id, postId, isPostPublished);
}
