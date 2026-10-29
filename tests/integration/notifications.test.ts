import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/server/db/client";
import { createComment, deleteComment } from "@/server/modules/comments";
import { followUser, unfollowUser } from "@/server/modules/follows";
import { runDailyJobs } from "@/server/modules/jobs";
import { likePost, unlikePost } from "@/server/modules/likes";
import {
  getHasUnread,
  getNotificationPreferences,
  listNotifications,
  markAllNotificationsRead,
  NOTIFICATION_RETENTION_DAYS,
  purgeOldNotifications,
  updateNotificationPreferences,
} from "@/server/modules/notifications";

import { resetDatabase } from "../helpers/database";
import { actorFor, createPost, createUser } from "../helpers/factories";
import { createFakeMediaProvider } from "../helpers/fake-media";

// Notifications (roadmap P2-07; NTF-01…05, API_SPECIFICATION §9.1): comments, replies, follows and
// likes notify the right person once, likes group per post per day, preferences switch types off,
// and old ones are purged after 90 days.

async function member(name = "Asha") {
  const user = await createUser();
  const profile = await db.profile.create({
    data: { userId: user.id, username: `nt${user.id.slice(-8)}`, displayName: name },
  });
  return { actor: actorFor(user), userId: user.id, username: profile.username };
}

const list = (who: { actor: ReturnType<typeof actorFor> }) => listNotifications(who.actor, {});

describe("notifications", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await resetDatabase();
    await db.$disconnect();
  });

  it("tells the post's author about a comment, but not about their own", async () => {
    const maker = await member("Meera");
    const asha = await member("Asha");
    const post = await createPost({ authorId: maker.userId, title: "Cherry blossom hoop" });

    await createComment(asha.actor, post.id, { body: "Lovely!" });
    await createComment(maker.actor, post.id, { body: "Thank you" });

    const { items } = await list(maker);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      type: "COMMENT",
      isUnread: true,
      post: { id: post.id, title: "Cherry blossom hoop" },
    });
    expect(items[0]?.actors.map((a) => a.displayName)).toEqual(["Asha"]);
    expect((await list(asha)).items).toHaveLength(0);
  });

  it("tells the commenter about a reply and the post's author about it too, once each", async () => {
    const maker = await member("Meera");
    const asha = await member("Asha");
    const ravi = await member("Ravi");
    const post = await createPost({ authorId: maker.userId });
    const comment = await createComment(asha.actor, post.id, { body: "Question?" });

    await createComment(ravi.actor, post.id, { body: "Answer", parentId: comment.id });
    // The post's author answering the commenter is one REPLY, not a REPLY and a COMMENT.
    await createComment(maker.actor, post.id, { body: "Also answer", parentId: comment.id });

    expect((await list(asha)).items.map((i) => i.type)).toEqual(["REPLY", "REPLY"]);
    expect((await list(maker)).items.map((i) => i.type)).toEqual(["COMMENT", "COMMENT"]);
  });

  it("removes a comment's notification with the comment", async () => {
    const maker = await member();
    const asha = await member();
    const post = await createPost({ authorId: maker.userId });
    const comment = await createComment(asha.actor, post.id, { body: "Hi" });

    await deleteComment(asha.actor, comment.id);

    expect((await list(maker)).items).toHaveLength(0);
  });

  it("notifies a follow once and takes it back on unfollow", async () => {
    const meera = await member("Meera");
    const asha = await member("Asha");

    await followUser(asha.actor, meera.username);
    await followUser(asha.actor, meera.username);
    const { items } = await list(meera);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ type: "FOLLOW", post: null });

    await unfollowUser(asha.actor, meera.username);
    expect((await list(meera)).items).toHaveLength(0);
  });

  it("groups likes on a post for the day and does not repeat a like", async () => {
    const maker = await member("Meera");
    const post = await createPost({ authorId: maker.userId });
    const fans = [await member("Asha"), await member("Ravi"), await member("Zoya")];
    for (const fan of fans) await likePost(fan.actor, post.id);
    await likePost(fans[0]?.actor ?? null, post.id);

    const { items } = await list(maker);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ type: "LIKE", actorCount: 3 });
    expect(items[0]?.actors).toHaveLength(2);

    await unlikePost(fans[1]?.actor ?? null, post.id);
    expect((await list(maker)).items[0]?.actorCount).toBe(2);
  });

  it("leaves out posts that are no longer published", async () => {
    const maker = await member();
    const asha = await member();
    const post = await createPost({ authorId: maker.userId });
    await likePost(asha.actor, post.id);

    await db.post.update({ where: { id: post.id }, data: { status: "UNPUBLISHED" } });

    expect((await list(maker)).items).toHaveLength(0);
  });

  it("shows an unread dot until everything is marked read", async () => {
    const meera = await member();
    const asha = await member();
    expect(await getHasUnread(meera.actor)).toBe(false);

    await followUser(asha.actor, meera.username);
    expect(await getHasUnread(meera.actor)).toBe(true);

    await markAllNotificationsRead(meera.actor);
    expect(await getHasUnread(meera.actor)).toBe(false);
    expect((await list(meera)).items[0]?.isUnread).toBe(false);
  });

  it("skips a type the recipient switched off", async () => {
    const meera = await member();
    const asha = await member();
    expect(await getNotificationPreferences(meera.actor)).toEqual({
      COMMENT: true,
      REPLY: true,
      FOLLOW: true,
      LIKE: true,
    });

    expect(await updateNotificationPreferences(meera.actor, { FOLLOW: false })).toMatchObject({
      FOLLOW: false,
      LIKE: true,
    });
    await followUser(asha.actor, meera.username);
    expect((await list(meera)).items).toHaveLength(0);

    await updateNotificationPreferences(meera.actor, { FOLLOW: true });
    expect(await db.notificationPreference.count()).toBe(0);
  });

  it("keeps notifications 90 days", async () => {
    const meera = await member();
    const asha = await member();
    const ravi = await member();
    await followUser(asha.actor, meera.username);
    const old = new Date(Date.now() - (NOTIFICATION_RETENTION_DAYS + 1) * 24 * 60 * 60 * 1000);
    await db.notification.updateMany({ data: { createdAt: old } });
    await followUser(ravi.actor, meera.username);

    expect(await purgeOldNotifications()).toBe(1);
    expect(await db.notification.count()).toBe(1);
    const outcomes = await runDailyJobs({ provider: createFakeMediaProvider() });
    expect(outcomes.find((o) => o.job === "purge-notifications")).toMatchObject({ ok: true });
  });

  it("pages through the list", async () => {
    const maker = await member();
    const post = await createPost({ authorId: maker.userId });
    for (let i = 0; i < 52; i += 1) {
      const fan = await member();
      await createComment(fan.actor, post.id, { body: `c${i}` });
    }

    const first = await list(maker);
    expect(first.items).toHaveLength(50);
    const second = await listNotifications(maker.actor, { cursor: first.nextCursor ?? undefined });
    expect(second.items).toHaveLength(2);
    expect(second.nextCursor).toBeNull();
  });
});
