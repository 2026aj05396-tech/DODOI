import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/server/db/client";
import { getPostLikeState, LIKE_RATE_LIMIT, likePost, unlikePost } from "@/server/modules/likes";

import { resetDatabase } from "../helpers/database";
import { actorFor, createPost, createUser } from "../helpers/factories";

// Likes (roadmap P2-05; LIKE-01, LIKE-02, API_SPECIFICATION §9.1): one like per user per post,
// idempotent, verified users only, and only the post's author sees the count.

async function member(overrides: { emailVerified?: Date | null } = {}) {
  return actorFor(await createUser(overrides));
}

describe("likes", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await resetDatabase();
    await db.$disconnect();
  });

  it("likes once however many times it is asked, and unlikes", async () => {
    const post = await createPost();
    const asha = await member();

    await likePost(asha, post.id);
    await likePost(asha, post.id);
    expect(await db.postLike.count({ where: { postId: post.id } })).toBe(1);
    expect(await getPostLikeState(asha, post.id)).toEqual({ isLiked: true, likeCount: null });

    await unlikePost(asha, post.id);
    await unlikePost(asha, post.id);
    expect(await getPostLikeState(asha, post.id)).toEqual({ isLiked: false, likeCount: null });
  });

  it("shows the count to the post's author only", async () => {
    const maker = await member();
    const post = await createPost({ authorId: maker.id });
    await likePost(await member(), post.id);
    const ravi = await member();
    await likePost(ravi, post.id);

    expect(await getPostLikeState(maker, post.id)).toEqual({ isLiked: false, likeCount: 2 });
    expect(await getPostLikeState(ravi, post.id)).toEqual({ isLiked: true, likeCount: null });
  });

  it("needs a signed-in, verified user and a published post", async () => {
    const post = await createPost();
    const draft = await createPost({ status: "DRAFT" });
    const unverified = await member({ emailVerified: null });
    const asha = await member();

    await expect(likePost(null, post.id)).rejects.toMatchObject({ status: 401 });
    await expect(likePost(unverified, post.id)).rejects.toMatchObject({
      status: 403,
      code: "EMAIL_NOT_VERIFIED",
    });
    await expect(likePost(asha, draft.id)).rejects.toMatchObject({ status: 404 });
    await expect(unlikePost(asha, draft.id)).rejects.toMatchObject({ status: 404 });
  });

  it("allows 200 likes an hour", async () => {
    const post = await createPost();
    const asha = await member();
    for (let i = 0; i < LIKE_RATE_LIMIT.limit; i += 1) await likePost(asha, post.id);
    await expect(likePost(asha, post.id)).rejects.toMatchObject({ status: 429 });
  });

  it("goes when the post is deleted", async () => {
    const post = await createPost();
    await likePost(await member(), post.id);
    await db.post.delete({ where: { id: post.id } });
    expect(await db.postLike.count()).toBe(0);
  });
});
