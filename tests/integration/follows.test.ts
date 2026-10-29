import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/server/db/client";
import { getFeed, getFeedFilters } from "@/server/modules/feed";
import {
  FOLLOW_RATE_LIMIT,
  followUser,
  getFollowState,
  getFollowedUserIds,
  getOwnFollowCounts,
  listOwnFollowers,
  listOwnFollowing,
  unfollowUser,
} from "@/server/modules/follows";

import { resetDatabase } from "../helpers/database";
import { actorFor, createPost, createSkill, createUser } from "../helpers/factories";
import { createFakeMediaProvider } from "../helpers/fake-media";

// Follows (roadmap P2-06; FLW-01…04, API_SPECIFICATION §9.1): public profiles only, idempotent,
// verified users only, counts and lists for the owner alone, and the feed's Following filter.

async function member(
  options: {
    emailVerified?: Date | null;
    visibility?: "PUBLIC" | "PRIVATE";
    isHidden?: boolean;
  } = {},
) {
  const user = await createUser({ emailVerified: options.emailVerified });
  const profile = await db.profile.create({
    data: {
      userId: user.id,
      username: `fw${user.id.slice(-8)}`,
      displayName: "Asha",
      visibility: options.visibility ?? "PUBLIC",
      isHidden: options.isHidden ?? false,
    },
  });
  return { actor: actorFor(user), userId: user.id, username: profile.username };
}

describe("follows", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await resetDatabase();
    await db.$disconnect();
  });

  it("follows once however many times it is asked, and unfollows", async () => {
    const asha = await member();
    const meera = await member();

    await followUser(asha.actor, meera.username);
    await followUser(asha.actor, meera.username);
    expect(await db.follow.count()).toBe(1);
    expect(await getFollowState(asha.actor, meera.username)).toEqual({
      canFollow: true,
      isFollowing: true,
    });

    await unfollowUser(asha.actor, meera.username);
    await unfollowUser(asha.actor, meera.username);
    expect(await getFollowState(asha.actor, meera.username)).toEqual({
      canFollow: true,
      isFollowing: false,
    });
  });

  it("cannot follow yourself, a private, hidden or unknown profile (404, no button)", async () => {
    const asha = await member();
    const priv = await member({ visibility: "PRIVATE" });
    const hidden = await member({ isHidden: true });

    for (const username of [asha.username, priv.username, hidden.username, "nobody-here"]) {
      await expect(followUser(asha.actor, username)).rejects.toMatchObject({ status: 404 });
      expect(await getFollowState(asha.actor, username)).toEqual({
        canFollow: false,
        isFollowing: false,
      });
    }
  });

  it("needs a signed-in, verified user", async () => {
    const meera = await member();
    const unverified = await member({ emailVerified: null });

    await expect(followUser(null, meera.username)).rejects.toMatchObject({ status: 401 });
    await expect(followUser(unverified.actor, meera.username)).rejects.toMatchObject({
      status: 403,
      code: "EMAIL_NOT_VERIFIED",
    });
  });

  it("keeps existing followers when a profile turns private, and still allows unfollowing", async () => {
    const asha = await member();
    const meera = await member();
    await followUser(asha.actor, meera.username);

    await db.profile.update({ where: { userId: meera.userId }, data: { visibility: "PRIVATE" } });

    expect(await db.follow.count()).toBe(1);
    await unfollowUser(asha.actor, meera.username);
    expect(await db.follow.count()).toBe(0);
  });

  it("gives counts and lists to the owner only, newest first", async () => {
    const meera = await member();
    const asha = await member();
    const ravi = await member();
    await followUser(asha.actor, meera.username);
    await followUser(ravi.actor, meera.username);
    await followUser(meera.actor, ravi.username);

    expect(await getOwnFollowCounts(meera.actor)).toEqual({ followers: 2, following: 1 });
    expect(await getOwnFollowCounts(asha.actor)).toEqual({ followers: 0, following: 1 });

    const followers = await listOwnFollowers(meera.actor, {});
    expect(followers.items.map((p) => p.username)).toEqual([ravi.username, asha.username]);
    const following = await listOwnFollowing(meera.actor, {});
    expect(following.items.map((p) => p.username)).toEqual([ravi.username]);
    expect(following.nextCursor).toBeNull();
  });

  it("allows 200 follows an hour", async () => {
    const asha = await member();
    const meera = await member();
    for (let i = 0; i < FOLLOW_RATE_LIMIT.limit; i += 1) {
      await followUser(asha.actor, meera.username);
    }
    await expect(followUser(asha.actor, meera.username)).rejects.toMatchObject({ status: 429 });
  });

  it("goes when either account is deleted", async () => {
    const asha = await member();
    const meera = await member();
    await followUser(asha.actor, meera.username);
    await db.user.delete({ where: { id: meera.userId } });
    expect(await getFollowedUserIds(asha.userId)).toEqual(new Set());
  });

  describe("in the feed", () => {
    const options = { provider: createFakeMediaProvider() };

    it("offers a Following filter once the user follows someone, with only their posts", async () => {
      const crochet = await createSkill("Crochet");
      const maker = await member();
      const reader = await member();
      const followed = await createPost({ authorId: maker.userId, skills: [{ id: crochet.id }] });
      await createPost({ skills: [{ id: crochet.id }] });

      expect((await getFeedFilters(reader.actor)).map((chip) => chip.key)).not.toContain(
        "following",
      );
      await followUser(reader.actor, maker.username);
      expect((await getFeedFilters(reader.actor)).map((chip) => chip.key)).toEqual(
        expect.arrayContaining(["for-you", "following", "new-to-you"]),
      );

      const page = await getFeed(reader.actor, { filter: "following", limit: 20 }, options);
      expect(page.items.map((item) => (item.kind === "post" ? item.post.id : null))).toEqual([
        followed.id,
      ]);
    });

    it("ranks a followed maker's post first in For you", async () => {
      const crochet = await createSkill("Crochet");
      const maker = await member();
      const reader = await member();
      await db.userSkill.create({
        data: { userId: reader.userId, skillId: crochet.id, isInterest: true },
      });
      // Older than the rest, so only the follow boost can put it first.
      const theirs = await createPost({
        authorId: maker.userId,
        skills: [{ id: crochet.id }],
        publishedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      });
      await createPost({ skills: [{ id: crochet.id }] });
      await followUser(reader.actor, maker.username);

      const page = await getFeed(reader.actor, { filter: "for-you", limit: 20 }, options);
      const ids = page.items.flatMap((item) => (item.kind === "post" ? [item.post.id] : []));
      expect(ids[0]).toBe(theirs.id);
    });
  });
});
