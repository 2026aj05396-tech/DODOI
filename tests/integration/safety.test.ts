import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/server/db/client";
import { blockUser, listBlocks, unblockUser } from "@/server/modules/blocks";
import { createComment, getCommentCount, listComments } from "@/server/modules/comments";
import { getPostDetail, getPostCards, listOwnPosts } from "@/server/modules/content";
import { getFeed } from "@/server/modules/feed";
import { followUser } from "@/server/modules/follows";
import { likePost } from "@/server/modules/likes";
import { listNotifications, notify } from "@/server/modules/notifications";
import {
  actOnReport,
  changeModeratorRole,
  createReport,
  listReportGroups,
} from "@/server/modules/reports";
import { getProfileForView } from "@/server/modules/users";

import { resetDatabase } from "../helpers/database";
import { actorFor, createPost, createSkill, createUser } from "../helpers/factories";
import { createFakeMediaProvider } from "../helpers/fake-media";

// Safety (roadmap P2-08; MOD-01…05, API_SPECIFICATION §6b/§9.1): blocking works both ways and
// hides everything between the two; posts and comments can be reported, hidden by a moderator and
// shown again; admins hand out the Moderator role.

const provider = { provider: createFakeMediaProvider() };

async function member(role: "USER" | "MODERATOR" | "ADMIN" = "USER", name = "Asha") {
  const user = await createUser();
  if (role !== "USER") await db.user.update({ where: { id: user.id }, data: { role } });
  const profile = await db.profile.create({
    data: { userId: user.id, username: `sf${user.id.slice(-8)}`, displayName: name },
  });
  return { actor: actorFor(user, role), userId: user.id, username: profile.username };
}

describe("safety", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await resetDatabase();
    await db.$disconnect();
  });

  describe("blocking", () => {
    it("hides each other's profile, both ways, and takes follows and notifications away", async () => {
      const asha = await member();
      const ravi = await member();
      await followUser(asha.actor, ravi.username);
      await followUser(ravi.actor, asha.username);

      await blockUser(asha.actor, ravi.username);
      await blockUser(asha.actor, ravi.username);

      await expect(getProfileForView(asha.actor, ravi.username)).rejects.toMatchObject({
        status: 404,
      });
      await expect(getProfileForView(ravi.actor, asha.username)).rejects.toMatchObject({
        status: 404,
      });
      expect(await db.follow.count()).toBe(0);
      expect((await listNotifications(asha.actor, {})).items).toHaveLength(0);
      expect((await listNotifications(ravi.actor, {})).items).toHaveLength(0);
      expect((await listBlocks(asha.actor, {})).items.map((p) => p.username)).toEqual([
        ravi.username,
      ]);
      expect((await listBlocks(ravi.actor, {})).items).toEqual([]);
    });

    it("cannot follow, like or comment on each other, and sends no notifications", async () => {
      const asha = await member();
      const ravi = await member();
      const post = await createPost({ authorId: ravi.userId });
      await blockUser(asha.actor, ravi.username);

      await expect(followUser(asha.actor, ravi.username)).rejects.toMatchObject({ status: 404 });
      await expect(followUser(ravi.actor, asha.username)).rejects.toMatchObject({ status: 404 });
      await expect(likePost(asha.actor, post.id)).rejects.toMatchObject({ status: 404 });
      await expect(createComment(asha.actor, post.id, { body: "Hi" })).rejects.toMatchObject({
        status: 404,
      });
      await notify({ type: "FOLLOW", recipientId: ravi.userId, actorId: asha.userId });
      expect(await db.notification.count()).toBe(0);
    });

    it("hides posts, comments, feed items and cards between the two, and unblocking brings them back", async () => {
      const crochet = await createSkill("Crochet");
      const asha = await member();
      const ravi = await member();
      const meera = await member();
      await db.userSkill.create({
        data: { userId: asha.userId, skillId: crochet.id, isInterest: true },
      });
      const raviPost = await createPost({ authorId: ravi.userId, skills: [{ id: crochet.id }] });
      const meeraPost = await createPost({ authorId: meera.userId, skills: [{ id: crochet.id }] });
      await createComment(ravi.actor, meeraPost.id, { body: "From Ravi" });
      await createComment(meera.actor, meeraPost.id, { body: "From Meera" });

      await blockUser(asha.actor, ravi.username);

      await expect(getPostDetail(asha.actor, raviPost.id, provider)).rejects.toMatchObject({
        status: 404,
      });
      await expect(getPostDetail(ravi.actor, raviPost.id, provider)).resolves.toBeDefined();
      expect(
        (await getPostCards(asha.actor, [raviPost.id, meeraPost.id], provider)).map((c) => c.id),
      ).toEqual([meeraPost.id]);
      const feed = await getFeed(asha.actor, { filter: "for-you", limit: 20 }, provider);
      expect(feed.items.map((i) => (i.kind === "post" ? i.post.id : null))).toEqual([meeraPost.id]);
      expect((await listComments(asha.actor, meeraPost.id, {})).items.map((c) => c.body)).toEqual([
        "From Meera",
      ]);
      // The other side sees nothing of the blocker's comments either.
      await createComment(asha.actor, meeraPost.id, { body: "From Asha" });
      expect((await listComments(ravi.actor, meeraPost.id, {})).items.map((c) => c.body)).toEqual([
        "From Ravi",
        "From Meera",
      ]);

      await unblockUser(asha.actor, ravi.username);
      await expect(getPostDetail(asha.actor, raviPost.id, provider)).resolves.toBeDefined();
      expect((await listComments(asha.actor, meeraPost.id, {})).items).toHaveLength(3);
    });

    it("cannot block yourself or an unknown username", async () => {
      const asha = await member();
      await expect(blockUser(asha.actor, asha.username)).rejects.toMatchObject({
        status: 422,
        code: "SELF_BLOCK",
      });
      await expect(blockUser(asha.actor, "nobody-here")).rejects.toMatchObject({ status: 404 });
      await expect(blockUser(null, asha.username)).rejects.toMatchObject({ status: 401 });
    });
  });

  describe("reports and moderation", () => {
    it("reports a post or a comment once, not your own, and not as a stranger to it", async () => {
      const maker = await member();
      const asha = await member();
      const post = await createPost({ authorId: maker.userId });
      const comment = await createComment(maker.actor, post.id, { body: "Mine" });

      await createReport(asha.actor, {
        targetType: "POST",
        targetId: post.id,
        reason: "NOT_MY_WORK",
      });
      await createReport(asha.actor, { targetType: "POST", targetId: post.id, reason: "SPAM" });
      await createReport(asha.actor, {
        targetType: "COMMENT",
        targetId: comment.id,
        reason: "OFFENSIVE",
      });
      expect(await db.report.count()).toBe(2);

      await expect(
        createReport(maker.actor, { targetType: "POST", targetId: post.id, reason: "SPAM" }),
      ).rejects.toMatchObject({ status: 422, code: "SELF_REPORT" });
      await expect(
        createReport(maker.actor, { targetType: "COMMENT", targetId: comment.id, reason: "SPAM" }),
      ).rejects.toMatchObject({ status: 422, code: "SELF_REPORT" });
      await expect(
        createReport(asha.actor, { targetType: "POST", targetId: "missing", reason: "SPAM" }),
      ).rejects.toMatchObject({ status: 404 });
      await blockUser(maker.actor, asha.username);
      await expect(
        createReport(asha.actor, { targetType: "COMMENT", targetId: comment.id, reason: "SPAM" }),
      ).rejects.toMatchObject({ status: 404 });
    });

    it("lets a moderator hide a post: gone for others, still there for its author, then shown again", async () => {
      const maker = await member();
      const asha = await member();
      const moderator = await member("MODERATOR", "Mod");
      const post = await createPost({ authorId: maker.userId });
      // A maker's own post has no attribution row (invited creators' seeded posts do).
      await db.postAttribution.deleteMany({ where: { postId: post.id } });
      await createReport(asha.actor, {
        targetType: "POST",
        targetId: post.id,
        reason: "OFFENSIVE",
      });
      const [group] = (await listReportGroups(moderator.actor, { status: "OPEN" })).items;
      expect(group).toMatchObject({ targetType: "POST", target: { detail: "Post" } });
      const reportId = group?.reportId ?? "";

      await actOnReport(moderator.actor, reportId, { action: "HIDE_TARGET" });

      await expect(getPostDetail(asha.actor, post.id, provider)).rejects.toMatchObject({
        status: 404,
      });
      await expect(getPostDetail(null, post.id, provider)).rejects.toMatchObject({ status: 404 });
      expect(await getPostDetail(maker.actor, post.id, provider)).toMatchObject({ isHidden: true });
      expect(await getPostDetail(moderator.actor, post.id, provider)).toMatchObject({
        isHidden: true,
      });
      expect(await getPostCards(asha.actor, [post.id], provider)).toEqual([]);
      await expect(likePost(asha.actor, post.id)).rejects.toMatchObject({ status: 404 });
      expect((await listOwnPosts(maker.actor, { status: "DRAFT", limit: 10 })).items).toMatchObject(
        [{ id: post.id, isHidden: true }],
      );
      expect(await db.auditLog.count({ where: { action: "report.hide_target" } })).toBe(1);

      const resolved = (await listReportGroups(moderator.actor, { status: "RESOLVED" })).items[0];
      await actOnReport(moderator.actor, resolved?.reportId ?? "", { action: "RESTORE_TARGET" });
      await expect(getPostDetail(asha.actor, post.id, provider)).resolves.toMatchObject({
        isHidden: false,
      });
    });

    it("hides a comment from others but not from its writer", async () => {
      const maker = await member();
      const asha = await member();
      const ravi = await member();
      const moderator = await member("MODERATOR");
      const post = await createPost({ authorId: maker.userId });
      const comment = await createComment(asha.actor, post.id, { body: "Rude" });
      await createReport(ravi.actor, {
        targetType: "COMMENT",
        targetId: comment.id,
        reason: "OFFENSIVE",
      });
      const [group] = (await listReportGroups(moderator.actor, { status: "OPEN" })).items;
      expect(group?.target).toMatchObject({ label: "Rude", detail: "Comment" });

      await actOnReport(moderator.actor, group?.reportId ?? "", { action: "HIDE_TARGET" });

      expect((await listComments(ravi.actor, post.id, {})).items).toHaveLength(0);
      expect((await listComments(asha.actor, post.id, {})).items[0]).toMatchObject({
        isHidden: true,
        body: "Rude",
      });
      expect(await getCommentCount(post.id)).toBe(0);
    });

    it("dismisses a report without hiding anything", async () => {
      const maker = await member();
      const asha = await member();
      const admin = await member("ADMIN");
      const post = await createPost({ authorId: maker.userId });
      await createReport(asha.actor, { targetType: "POST", targetId: post.id, reason: "SPAM" });
      const [group] = (await listReportGroups(admin.actor, { status: "OPEN" })).items;

      await actOnReport(admin.actor, group?.reportId ?? "", { action: "DISMISS" });

      await expect(getPostDetail(asha.actor, post.id, provider)).resolves.toBeDefined();
      expect((await listReportGroups(admin.actor, { status: "OPEN" })).items).toHaveLength(0);
    });

    it("keeps the queue for moderators and admins: others get a 404", async () => {
      const asha = await member();
      await expect(listReportGroups(asha.actor, { status: "OPEN" })).rejects.toMatchObject({
        status: 404,
      });
      await expect(actOnReport(asha.actor, "x", { action: "HIDE_TARGET" })).rejects.toMatchObject({
        status: 404,
      });
      await expect(listReportGroups(null, { status: "OPEN" })).rejects.toMatchObject({
        status: 404,
      });
    });
  });

  describe("moderator role", () => {
    it("lets an admin make and remove moderators, audited; moderators cannot, admins stay admins", async () => {
      const admin = await member("ADMIN");
      const asha = await member();
      const mod = await member("MODERATOR");

      await changeModeratorRole(admin.actor, asha.userId, "MODERATOR");
      expect((await db.user.findUniqueOrThrow({ where: { id: asha.userId } })).role).toBe(
        "MODERATOR",
      );
      await changeModeratorRole(admin.actor, asha.userId, "USER");
      expect((await db.user.findUniqueOrThrow({ where: { id: asha.userId } })).role).toBe("USER");
      expect(
        await db.auditLog.count({
          where: { action: { in: ["user.make_moderator", "user.remove_moderator"] } },
        }),
      ).toBe(2);

      await expect(changeModeratorRole(mod.actor, asha.userId, "MODERATOR")).rejects.toMatchObject({
        status: 404,
      });
      await expect(changeModeratorRole(admin.actor, admin.userId, "USER")).rejects.toMatchObject({
        status: 422,
        code: "ADMIN_ROLE_LOCKED",
      });
      await expect(changeModeratorRole(admin.actor, "nobody", "USER")).rejects.toMatchObject({
        status: 404,
      });
    });
  });
});
