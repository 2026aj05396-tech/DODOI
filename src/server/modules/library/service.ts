import "server-only";

import type {
  CreateCollectionInput,
  ListPageQuery,
  UpdateCollectionInput,
} from "@/lib/schemas/collections";
import type { UpdateProfileInput } from "@/lib/schemas/me";
import type { Paginated } from "@/lib/types/api";
import type { CollectionPage, CollectionSummary, SaveResult } from "@/lib/types/collections";
import type { MyProfile, ProfileView } from "@/lib/types/me";
import type { PostCard } from "@/lib/types/posts";
import { mediaProvider as defaultProvider, type MediaProvider } from "@/server/integrations/media";
import type { Actor } from "@/server/lib/actor";
import { UnauthenticatedError } from "@/server/lib/errors";
import {
  addToCollection as addItem,
  createCollection as insertCollection,
  getCollectionPage as loadCollectionPage,
  listMyCollections,
  listPublicCollections,
  listSavedPostIds,
  savePost as save,
  updateCollection as changeCollection,
  type CollectionRow,
} from "@/server/modules/collections";
import {
  avatarUrl,
  getMedia,
  getOwnAvatar,
  getPostCards,
  isPostPublished,
} from "@/server/modules/content";
import {
  getOwnProfile,
  getProfileForView,
  getProfileSkills,
  showsUsernamePrompt,
  updateOwnProfile,
  usernameChangeAvailableAt,
  type OwnProfileRow,
} from "@/server/modules/users";

// The user's library (COLL-01…07) and profiles (PRF-01…08): data from the collections and users
// modules combined with post cards and media from the content module. It sits above them because
// content already depends on collections and users, and module imports must not form a cycle.

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

// --- Profiles (P1-13) ------------------------------------------------------------------------

async function toMyProfile(row: OwnProfileRow, provider: MediaProvider): Promise<MyProfile> {
  return {
    username: row.username,
    displayName: row.displayName,
    bio: row.bio,
    avatar: row.avatarMediaId ? await getMedia(row.avatarMediaId, { provider }) : null,
    visibility: row.visibility,
    usernameChangeAvailableAt: usernameChangeAvailableAt(row)?.toISOString() ?? null,
    showUsernamePrompt: showsUsernamePrompt(row),
    email: row.user.email,
    hasPassword: row.user.passwordHash !== null,
  };
}

/** GET /api/me/profile. */
export async function getMyProfile(
  actor: Actor,
  { provider = defaultProvider }: ProviderOption = {},
): Promise<MyProfile> {
  return toMyProfile(await getOwnProfile(actor), provider);
}

/** PATCH /api/me/profile: a new avatar must be the user's own uploaded avatar (P1-12). */
export async function updateMyProfile(
  actor: Actor,
  input: UpdateProfileInput,
  { provider = defaultProvider }: ProviderOption = {},
): Promise<MyProfile> {
  if (!actor) throw new UnauthenticatedError();
  if (input.avatarMediaId) await getOwnAvatar(actor, input.avatarMediaId, { provider });
  return toMyProfile(await updateOwnProfile(actor, input), provider);
}

/**
 * GET /api/profiles/{username} (PRF-05…08): never email, date of birth, role or ids. Others see
 * a private profile as name, username and avatar only (OD-10).
 */
export async function getProfile(
  actor: Actor,
  username: string,
  { provider = defaultProvider }: ProviderOption = {},
): Promise<ProfileView> {
  const profile = await getProfileForView(actor, username);
  const avatar = profile.avatarPublicId ? avatarUrl(profile.avatarPublicId, { provider }) : null;
  if (profile.isPrivate) {
    return {
      isPrivate: true,
      username: profile.username,
      displayName: profile.displayName,
      avatarUrl: avatar,
    };
  }
  const [skills, collections] = await Promise.all([
    getProfileSkills(profile.userId),
    listPublicCollections(profile.userId),
  ]);
  return {
    isPrivate: false,
    isOwner: profile.isOwner,
    visibility: profile.visibility,
    isHidden: profile.isOwner && profile.isHidden,
    username: profile.username,
    displayName: profile.displayName,
    bio: profile.bio,
    avatarUrl: avatar,
    skills,
    publicCollections: await toSummaries(actor, collections, provider),
  };
}
