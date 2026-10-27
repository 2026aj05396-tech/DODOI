import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { getActor } from "@/server/auth";
import { db } from "@/server/db/client";
import type { AuthenticatedActor } from "@/server/lib/actor";
import {
  deleteCollection,
  getCollectionIdsForPost,
  removeFromCollection,
  unsavePost,
} from "@/server/modules/collections";
import {
  addToCollection,
  createCollection,
  getCollection,
  listCollections,
  listSavedPosts,
  savePost,
  updateCollection,
} from "@/server/modules/library";

import * as savesRoute from "../../src/app/api/saves/route";
import { resetDatabase } from "../helpers/database";
import { actorFor, createCreator, createPost, createUser } from "../helpers/factories";
import { createFakeMediaProvider } from "../helpers/fake-media";

// Saves and collections (roadmap P1-24, COLL-01…07, OD-17): idempotent saves, unsave leaves
// every collection, deleting a collection keeps saves, private → 404 for others.

vi.mock("@/server/auth", () => ({ getActor: vi.fn() }));
const mockedGetActor = vi.mocked(getActor);
const options = { provider: createFakeMediaProvider() };
const page = { limit: 20 };

async function user(verified = true): Promise<AuthenticatedActor> {
  return actorFor(await createUser({ emailVerified: verified ? new Date() : null }));
}

/** A user with a public profile, so others may see their public collections. */
async function creator(): Promise<AuthenticatedActor> {
  return actorFor(await createCreator());
}

describe("saves and collections", () => {
  beforeEach(async () => {
    await resetDatabase();
    mockedGetActor.mockReset();
  });

  afterAll(async () => {
    await resetDatabase();
  });

  it("saves idempotently, lists newest first and refuses unpublished posts", async () => {
    const actor = await user();
    const first = await createPost();
    const second = await createPost();
    const draft = await createPost({ status: "DRAFT" });

    const saved = await savePost(actor, first.id);
    expect(await savePost(actor, first.id)).toEqual(saved);
    await savePost(actor, second.id);
    await expect(savePost(actor, draft.id)).rejects.toMatchObject({ status: 404 });

    const all = await listSavedPosts(actor, page, options);
    expect(all.items.map((card) => card.id)).toEqual([second.id, first.id]);
    expect(all.items.every((card) => card.isSaved)).toBe(true);

    const onePerPage = await listSavedPosts(actor, { limit: 1 }, options);
    const next = await listSavedPosts(
      actor,
      { limit: 1, cursor: onePerPage.nextCursor ?? "" },
      options,
    );
    expect(next.items.map((card) => card.id)).toEqual([first.id]);
    expect(next.nextCursor).toBeNull();
  });

  it("adding to a collection saves first; unsave removes it from every collection", async () => {
    const actor = await user();
    const post = await createPost();
    const ideas = await createCollection(actor, { name: "Ideas", visibility: "PRIVATE" });
    const gifts = await createCollection(actor, { name: "Gifts", visibility: "PRIVATE" });

    await addToCollection(actor, ideas.id, post.id);
    await addToCollection(actor, ideas.id, post.id);
    await addToCollection(actor, gifts.id, post.id);

    expect((await listSavedPosts(actor, page, options)).items).toHaveLength(1);
    expect((await getCollectionIdsForPost(actor, post.id)).sort()).toEqual(
      [ideas.id, gifts.id].sort(),
    );

    await unsavePost(actor, post.id);
    expect(await getCollectionIdsForPost(actor, post.id)).toEqual([]);
    expect((await getCollection(actor, ideas.id, page, options)).items).toEqual([]);
  });

  it("removing from a collection or deleting it keeps the save", async () => {
    const actor = await user();
    const post = await createPost();
    const ideas = await createCollection(actor, { name: "Ideas", visibility: "PRIVATE" });
    const gifts = await createCollection(actor, { name: "Gifts", visibility: "PRIVATE" });
    await addToCollection(actor, ideas.id, post.id);
    await addToCollection(actor, gifts.id, post.id);

    await removeFromCollection(actor, ideas.id, post.id);
    await deleteCollection(actor, gifts.id);

    expect((await listSavedPosts(actor, page, options)).items.map((card) => card.id)).toEqual([
      post.id,
    ]);
    expect((await listCollections(actor, options)).map((item) => item.name)).toEqual(["Ideas"]);
  });

  it("lists collections most recently changed first, with counts and covers", async () => {
    const actor = await user();
    const [older, newer, hidden] = [await createPost(), await createPost(), await createPost()];
    const ideas = await createCollection(actor, { name: "Ideas", visibility: "PRIVATE" });
    const gifts = await createCollection(actor, { name: "Gifts", visibility: "PRIVATE" });
    await addToCollection(actor, gifts.id, older.id);
    await addToCollection(actor, ideas.id, older.id);
    await addToCollection(actor, ideas.id, newer.id);
    await addToCollection(actor, ideas.id, hidden.id);
    await db.post.update({ where: { id: hidden.id }, data: { status: "UNPUBLISHED" } });

    const collections = await listCollections(actor, options);

    expect(collections.map((item) => item.name)).toEqual(["Ideas", "Gifts"]);
    expect(collections[0]).toMatchObject({ itemCount: 2, visibility: "PRIVATE" });
    const newerMedia = await db.postMedia.findFirstOrThrow({ where: { postId: newer.id } });
    expect(collections[0]?.coverMedia?.id).toBe(newerMedia.mediaId);
  });

  it("keeps names unique per user, ignoring case and spaces, and caps collections at 100", async () => {
    const actor = await user();
    const other = await user();
    await createCollection(actor, { name: "Crochet ideas", visibility: "PRIVATE" });

    await expect(
      createCollection(actor, { name: "  crochet   IDEAS ", visibility: "PRIVATE" }),
    ).rejects.toMatchObject({ status: 409, code: "COLLECTION_NAME_TAKEN" });
    await expect(
      createCollection(other, { name: "Crochet ideas", visibility: "PRIVATE" }),
    ).resolves.toMatchObject({ name: "Crochet ideas" });

    const gifts = await createCollection(actor, { name: "Gifts", visibility: "PRIVATE" });
    await expect(
      updateCollection(actor, gifts.id, { name: "CROCHET IDEAS" }),
    ).rejects.toMatchObject({ code: "COLLECTION_NAME_TAKEN" });

    await db.collection.createMany({
      data: Array.from({ length: 98 }, (_, index) => ({
        userId: actor.id,
        name: `List ${index}`,
        nameNormalized: `list ${index}`,
      })),
    });
    await expect(
      createCollection(actor, { name: "One too many", visibility: "PRIVATE" }),
    ).rejects.toMatchObject({ status: 422, code: "COLLECTION_LIMIT_REACHED" });
  });

  it("shows a public collection to others, never a private one or a private profile's", async () => {
    const owner = await creator();
    const visitor = await user();
    const post = await createPost();
    const shared = await createCollection(owner, { name: "Shared", visibility: "PUBLIC" });
    const secret = await createCollection(owner, { name: "Secret", visibility: "PRIVATE" });
    await addToCollection(owner, shared.id, post.id);

    const seen = await getCollection(visitor, shared.id, page, options);
    expect(seen.collection).toMatchObject({
      isOwner: false,
      owner: { username: expect.any(String) },
    });
    expect(seen.items.map((card) => card.id)).toEqual([post.id]);
    expect((await getCollection(owner, shared.id, page, options)).collection).toMatchObject({
      isOwner: true,
      owner: null,
    });

    await expect(getCollection(visitor, secret.id, page, options)).rejects.toMatchObject({
      status: 404,
    });
    await expect(addToCollection(visitor, shared.id, post.id)).rejects.toMatchObject({
      status: 404,
    });

    await db.profile.update({ where: { userId: owner.id }, data: { visibility: "PRIVATE" } });
    await expect(getCollection(visitor, shared.id, page, options)).rejects.toMatchObject({
      status: 404,
    });
  });

  it("needs a verified email to make a collection public", async () => {
    const actor = await user(false);

    await expect(
      createCollection(actor, { name: "Shared", visibility: "PUBLIC" }),
    ).rejects.toMatchObject({ status: 403, code: "EMAIL_NOT_VERIFIED" });
    const mine = await createCollection(actor, { name: "Mine", visibility: "PRIVATE" });
    await expect(updateCollection(actor, mine.id, { visibility: "PUBLIC" })).rejects.toMatchObject({
      code: "EMAIL_NOT_VERIFIED",
    });
  });

  it("answers 401 when signed out", async () => {
    mockedGetActor.mockResolvedValue(null);
    const response = await savesRoute.GET(new NextRequest("http://localhost:3000/api/saves"), {
      params: Promise.resolve({}),
    });
    expect(response.status).toBe(401);
  });
});
