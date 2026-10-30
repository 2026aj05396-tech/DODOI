import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/server/db/client";
import { blockUser } from "@/server/modules/blocks";
import {
  COMMUNITY_CREATE_RATE_LIMIT,
  COMMUNITY_EDIT_WINDOW_MS,
  COMMUNITY_OWNED_LIMIT,
  createCommunity,
  createCommunityPost,
  deleteCommunity,
  deleteCommunityPost,
  getCommunityBySlug,
  getCommunityManageView,
  joinCommunity,
  leaveCommunity,
  listCommunities,
  listCommunityPosts,
  moderateCommunity,
  updateCommunityPost,
} from "@/server/modules/communities";
import { deleteAccountsDue } from "@/server/modules/jobs";
import { actOnReport, createReport, listReportGroups } from "@/server/modules/reports";

import { resetDatabase } from "../helpers/database";
import { actorFor, createMedia, createSkill, createUser } from "../helpers/factories";
import { createFakeMediaProvider } from "../helpers/fake-media";

// Communities (roadmap P3-01; COM-01…08, USER_FLOWS F-28): who can create, join and post, what each
// role may do, what the lists show, blocks, reports, and what account deletion hands over.

const provider = { provider: createFakeMediaProvider() };

async function member(options: { verified?: boolean; name?: string } = {}) {
  const user = await createUser({ emailVerified: options.verified === false ? null : new Date() });
  const profile = await db.profile.create({
    data: {
      userId: user.id,
      username: `cm${user.id.slice(-8)}`,
      displayName: options.name ?? "Asha",
    },
  });
  return { actor: actorFor(user), userId: user.id, username: profile.username };
}

type Who = Awaited<ReturnType<typeof member>>;

async function start(who: Who, skillId: string, name = "Watercolor Corner") {
  return createCommunity(who.actor, {
    name,
    skillId,
    description: "Washes, skies and happy accidents.",
    rules: ["Be kind", "Credit your sources"],
  });
}

async function setup() {
  const owner = await member({ name: "Owner" });
  const skill = await createSkill("Watercolor");
  const community = await start(owner, skill.id);
  return { owner, skill, community };
}

describe("communities", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await resetDatabase();
    await db.$disconnect();
  });

  describe("creating", () => {
    it("lets a verified member create a public community and become its owner", async () => {
      const { community } = await setup();

      expect(community).toMatchObject({
        name: "Watercolor Corner",
        slug: "watercolor-corner",
        myRole: "OWNER",
        rules: ["Be kind", "Credit your sources"],
        skill: { name: "Watercolor" },
        canPost: true,
      });
    });

    it("refuses unverified members, unavailable crafts, blocked words and duplicate names", async () => {
      const owner = await member();
      const newcomer = await member({ verified: false });
      const skill = await createSkill("Watercolor");
      const hidden = await createSkill("Hidden craft", { status: "HIDDEN" });
      await start(owner, skill.id);

      await expect(start(newcomer, skill.id, "Another")).rejects.toMatchObject({
        status: 403,
        code: "EMAIL_NOT_VERIFIED",
      });
      await expect(start(owner, hidden.id, "Another")).rejects.toMatchObject({ status: 400 });
      await expect(start(owner, skill.id, "fuck club")).rejects.toMatchObject({ status: 400 });
      await expect(
        createCommunity(owner.actor, {
          name: "Clean name",
          skillId: skill.id,
          description: "Fine",
          rules: ["no shit allowed"],
        }),
      ).rejects.toMatchObject({ status: 400 });
      await expect(start(owner, skill.id, "  watercolor   CORNER ")).rejects.toMatchObject({
        status: 422,
        code: "NAME_TAKEN",
      });
    });

    it("limits creation to 2 a day and 10 owned, and keeps slugs unique and off reserved words", async () => {
      const owner = await member();
      const skill = await createSkill("Watercolor");
      await start(owner, skill.id, "First one");
      await start(owner, skill.id, "First-one!");
      await expect(start(owner, skill.id, "Third")).rejects.toMatchObject({ status: 429 });
      expect(COMMUNITY_CREATE_RATE_LIMIT.limit).toBe(2);
      expect(
        (
          await db.community.findMany({ orderBy: { createdAt: "asc" }, select: { slug: true } })
        ).map((row) => row.slug),
      ).toEqual(["first-one", "first-one-2"]);

      const crowded = await member();
      for (let i = 0; i < COMMUNITY_OWNED_LIMIT; i += 1) {
        await db.community.create({
          data: {
            name: `Owned ${i}`,
            normalizedName: `owned ${i}`,
            slug: `owned-${i}`,
            skillId: skill.id,
            description: "x",
            createdById: crowded.userId,
            members: { create: { userId: crowded.userId, role: "OWNER" } },
          },
        });
      }
      await expect(start(crowded, skill.id, "One too many")).rejects.toMatchObject({
        status: 422,
        code: "COMMUNITY_LIMIT",
      });

      const other = await member();
      expect((await start(other, skill.id, "New")).slug).toBe("new-2");
    });
  });

  describe("discovering, joining and leaving", () => {
    it("lists communities in the member's interests first, then newest, and searches by name", async () => {
      const owner = await member();
      const reader = await member();
      const watercolor = await createSkill("Watercolor");
      const crochet = await createSkill("Crochet");
      await db.userSkill.create({
        data: { userId: reader.userId, skillId: crochet.id, isInterest: true },
      });
      await start(owner, watercolor.id, "Old washes");
      await start(owner, crochet.id, "Hooks");
      const other = await member();
      await start(other, watercolor.id, "New washes");

      const all = await listCommunities(reader.actor, {});
      expect(all.items.map((item) => item.name)).toEqual(["Hooks", "New washes", "Old washes"]);
      expect(
        (await listCommunities(reader.actor, { q: "washes" })).items.map((item) => item.name),
      ).toEqual(["New washes", "Old washes"]);
      expect(
        (await listCommunities(reader.actor, { skill: crochet.id })).items.map((i) => i.name),
      ).toEqual(["Hooks"]);
    });

    it("pages through both parts of the list with one cursor", async () => {
      const owner = await member();
      const reader = await member();
      const mine = await createSkill("Crochet");
      const rest = await createSkill("Watercolor");
      await db.userSkill.create({
        data: { userId: reader.userId, skillId: mine.id, isInterest: true },
      });
      const base = Date.now();
      for (let i = 0; i < 25; i += 1) {
        await db.community.create({
          data: {
            name: `C${i}`,
            normalizedName: `c${i}`,
            slug: `c${i}`,
            skillId: i < 5 ? mine.id : rest.id,
            description: "x",
            createdById: owner.userId,
            createdAt: new Date(base + i * 1000),
          },
        });
      }
      const first = await listCommunities(reader.actor, {});
      expect(first.items).toHaveLength(20);
      expect(first.items.slice(0, 5).map((item) => item.name)).toEqual([
        "C4",
        "C3",
        "C2",
        "C1",
        "C0",
      ]);
      expect(first.nextCursor).not.toBeNull();
      const second = await listCommunities(reader.actor, { cursor: first.nextCursor ?? "" });
      expect(second.items).toHaveLength(5);
      expect(second.nextCursor).toBeNull();
      const names = [...first.items, ...second.items].map((item) => item.name);
      expect(new Set(names).size).toBe(25);
    });

    it("joins, leaves, lists your circles, and keeps hidden communities out", async () => {
      const { owner, skill, community } = await setup();
      const ravi = await member({ name: "Ravi" });
      const hidden = await start(owner, skill.id, "Secret");
      await db.community.update({ where: { id: hidden.id }, data: { hiddenAt: new Date() } });

      expect((await getCommunityBySlug(ravi.actor, community.slug)).myRole).toBeNull();
      await joinCommunity(ravi.actor, community.slug);
      await joinCommunity(ravi.actor, community.slug);
      expect((await getCommunityBySlug(ravi.actor, community.slug)).myRole).toBe("MEMBER");
      expect((await listCommunities(ravi.actor, { mine: true })).items.map((i) => i.id)).toEqual([
        community.id,
      ]);
      await expect(getCommunityBySlug(ravi.actor, hidden.slug)).rejects.toMatchObject({
        status: 404,
      });
      await expect(joinCommunity(ravi.actor, hidden.slug)).rejects.toMatchObject({ status: 404 });
      expect((await listCommunities(ravi.actor, {})).items.map((i) => i.name)).toEqual([
        "Watercolor Corner",
      ]);

      await leaveCommunity(ravi.actor, community.slug);
      expect((await listCommunities(ravi.actor, { mine: true })).items).toEqual([]);
    });

    it("needs a verified email to join, and the owner must hand over before leaving", async () => {
      const { owner, community } = await setup();
      const newcomer = await member({ verified: false });
      const ravi = await member();

      await expect(joinCommunity(newcomer.actor, community.slug)).rejects.toMatchObject({
        status: 403,
      });
      await expect(leaveCommunity(owner.actor, community.slug)).rejects.toMatchObject({
        status: 422,
        code: "OWNER_MUST_HAND_OVER",
      });
      await joinCommunity(ravi.actor, community.slug);
      await moderateCommunity(owner.actor, community.slug, {
        action: "SET_ROLE",
        targetId: ravi.userId,
        role: "MODERATOR",
      });
      await moderateCommunity(owner.actor, community.slug, {
        action: "SET_ROLE",
        targetId: ravi.userId,
        role: "OWNER",
      });
      await leaveCommunity(owner.actor, community.slug);
      expect((await getCommunityBySlug(ravi.actor, community.slug)).myRole).toBe("OWNER");
      expect((await getCommunityBySlug(owner.actor, community.slug)).myRole).toBeNull();
    });
  });

  describe("discussions", () => {
    it("lets members post with photos and reply once deep, newest activity first", async () => {
      const { owner, community } = await setup();
      const ravi = await member({ name: "Ravi" });
      await joinCommunity(ravi.actor, community.slug);
      const photo = await createMedia({ ownerId: ravi.userId });

      const first = await createCommunityPost(ravi.actor, community.slug, {
        body: "Older post",
        mediaIds: [photo.id],
      });
      const second = await createCommunityPost(owner.actor, community.slug, {
        body: "Newer post",
        mediaIds: [],
      });
      expect(first.photos).toHaveLength(1);
      await createCommunityPost(owner.actor, community.slug, {
        body: "A reply to the older one",
        mediaIds: [],
        parentId: first.id,
      });

      const page = await listCommunityPosts(ravi.actor, community.slug);
      expect(page.items.map((item) => item.body)).toEqual(["Older post", "Newer post"]);
      expect(page.items[0]?.replies.map((reply) => reply.body)).toEqual([
        "A reply to the older one",
      ]);
      expect(second.isOwn).toBe(true);
    });

    it("lets anyone signed in read, but only joined, verified members write", async () => {
      const { community } = await setup();
      const outsider = await member();
      const newcomer = await member({ verified: false });

      expect((await listCommunityPosts(outsider.actor, community.slug)).items).toEqual([]);
      await expect(
        createCommunityPost(outsider.actor, community.slug, { body: "Hi", mediaIds: [] }),
      ).rejects.toMatchObject({ status: 403, code: "NOT_MEMBER" });
      await expect(
        createCommunityPost(newcomer.actor, community.slug, { body: "Hi", mediaIds: [] }),
      ).rejects.toMatchObject({ status: 403, code: "EMAIL_NOT_VERIFIED" });
    });

    it("checks replies and photos: parent in the same community and top level, own photos, text only", async () => {
      const { owner, skill, community } = await setup();
      const elsewhere = await start(owner, skill.id, "Elsewhere");
      const post = await createCommunityPost(owner.actor, community.slug, {
        body: "Post",
        mediaIds: [],
      });
      const reply = await createCommunityPost(owner.actor, community.slug, {
        body: "Reply",
        mediaIds: [],
        parentId: post.id,
      });
      const photo = await createMedia({ ownerId: (await member()).userId });

      await expect(
        createCommunityPost(owner.actor, elsewhere.slug, {
          body: "Wrong place",
          mediaIds: [],
          parentId: post.id,
        }),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        createCommunityPost(owner.actor, community.slug, {
          body: "Deeper",
          mediaIds: [],
          parentId: reply.id,
        }),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        createCommunityPost(owner.actor, community.slug, { body: "Mine?", mediaIds: [photo.id] }),
      ).rejects.toMatchObject({ status: 400 });
      await expect(
        createCommunityPost(owner.actor, community.slug, {
          body: "Photo reply",
          mediaIds: [photo.id],
          parentId: post.id,
        }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it("lets the author edit for 15 minutes and delete any time; others cannot", async () => {
      const { community } = await setup();
      const ravi = await member();
      const tara = await member();
      await joinCommunity(ravi.actor, community.slug);
      await joinCommunity(tara.actor, community.slug);
      const post = await createCommunityPost(ravi.actor, community.slug, {
        body: "First draft",
        mediaIds: [],
      });
      expect(post.canEdit).toBe(true);

      const edited = await updateCommunityPost(ravi.actor, post.id, { body: "Second draft" });
      expect(edited).toMatchObject({ body: "Second draft", isEdited: true });
      await expect(
        updateCommunityPost(tara.actor, post.id, { body: "Mine now" }),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        updateCommunityPost(
          ravi.actor,
          post.id,
          { body: "Too late" },
          { now: new Date(Date.now() + COMMUNITY_EDIT_WINDOW_MS + 1000) },
        ),
      ).rejects.toMatchObject({ status: 422, code: "EDIT_WINDOW_CLOSED" });
      await expect(deleteCommunityPost(tara.actor, post.id, provider)).rejects.toMatchObject({
        status: 404,
      });

      await deleteCommunityPost(ravi.actor, post.id, provider);
      expect((await listCommunityPosts(ravi.actor, community.slug)).items).toEqual([]);
    });

    it("hides blocked members' posts and replies both ways", async () => {
      const { owner, community } = await setup();
      const ravi = await member();
      await joinCommunity(ravi.actor, community.slug);
      const raviPost = await createCommunityPost(ravi.actor, community.slug, {
        body: "Ravi's post",
        mediaIds: [],
      });
      await createCommunityPost(owner.actor, community.slug, {
        body: "Owner's post",
        mediaIds: [],
      });
      await createCommunityPost(ravi.actor, community.slug, {
        body: "Ravi's reply",
        mediaIds: [],
        parentId: (await listCommunityPosts(ravi.actor, community.slug)).items.find(
          (item) => item.body === "Owner's post",
        )?.id,
      });

      await blockUser(owner.actor, ravi.username);

      const seenByOwner = await listCommunityPosts(owner.actor, community.slug);
      expect(seenByOwner.items.map((item) => item.body)).toEqual(["Owner's post"]);
      expect(seenByOwner.items[0]?.replies).toEqual([]);
      const seenByRavi = await listCommunityPosts(ravi.actor, community.slug);
      expect(seenByRavi.items.map((item) => item.body)).not.toContain("Owner's post");
      await expect(
        createCommunityPost(owner.actor, community.slug, {
          body: "Reply to a blocked member",
          mediaIds: [],
          parentId: raviPost.id,
        }),
      ).rejects.toMatchObject({ status: 404 });
    });
  });

  describe("moderation", () => {
    async function crew() {
      const base = await setup();
      const moderator = await member({ name: "Moderator" });
      const regular = await member({ name: "Regular" });
      const other = await member({ name: "Other" });
      for (const who of [moderator, regular, other])
        await joinCommunity(who.actor, base.community.slug);
      await moderateCommunity(base.owner.actor, base.community.slug, {
        action: "SET_ROLE",
        targetId: moderator.userId,
        role: "MODERATOR",
      });
      return { ...base, moderator, regular, other };
    }

    it("lets owner and moderators hide and restore posts, which others then cannot see", async () => {
      const { community, owner, moderator, regular, other } = await crew();
      const post = await createCommunityPost(regular.actor, community.slug, {
        body: "Questionable",
        mediaIds: [],
      });

      await moderateCommunity(moderator.actor, community.slug, {
        action: "HIDE_POST",
        targetId: post.id,
      });
      expect((await listCommunityPosts(other.actor, community.slug)).items).toEqual([]);
      const own = (await listCommunityPosts(regular.actor, community.slug)).items[0];
      expect(own).toMatchObject({ isHidden: true, canEdit: false });
      expect((await listCommunityPosts(owner.actor, community.slug)).items[0]?.isHidden).toBe(true);

      await moderateCommunity(owner.actor, community.slug, {
        action: "RESTORE_POST",
        targetId: post.id,
      });
      expect((await listCommunityPosts(other.actor, community.slug)).items).toHaveLength(1);
    });

    it("refuses regular members, and keeps each moderator inside their own community", async () => {
      const { community, skill, regular, owner, moderator } = await crew();
      const elsewhere = await start(owner, skill.id, "Elsewhere");
      const post = await createCommunityPost(regular.actor, community.slug, {
        body: "Post",
        mediaIds: [],
      });

      await expect(
        moderateCommunity(regular.actor, community.slug, {
          action: "HIDE_POST",
          targetId: post.id,
        }),
      ).rejects.toMatchObject({ status: 403, code: "NOT_MANAGER" });
      await expect(
        moderateCommunity(moderator.actor, elsewhere.slug, {
          action: "HIDE_POST",
          targetId: post.id,
        }),
      ).rejects.toMatchObject({ status: 403, code: "NOT_MANAGER" });
      await expect(
        moderateCommunity(owner.actor, elsewhere.slug, { action: "HIDE_POST", targetId: post.id }),
      ).rejects.toMatchObject({ status: 404 });
    });

    it("removes members until the owner allows them back; moderators cannot remove moderators or the owner", async () => {
      const { community, owner, moderator, regular } = await crew();

      await expect(
        moderateCommunity(moderator.actor, community.slug, {
          action: "REMOVE_MEMBER",
          targetId: owner.userId,
        }),
      ).rejects.toMatchObject({ status: 422, code: "INVALID_TARGET" });
      await moderateCommunity(moderator.actor, community.slug, {
        action: "REMOVE_MEMBER",
        targetId: regular.userId,
      });

      const view = await getCommunityBySlug(regular.actor, community.slug);
      expect(view).toMatchObject({ myRole: null, isRemoved: true, canPost: false, canJoin: false });
      await expect(joinCommunity(regular.actor, community.slug)).rejects.toMatchObject({
        status: 403,
        code: "REMOVED",
      });
      await expect(
        moderateCommunity(moderator.actor, community.slug, {
          action: "ALLOW_MEMBER",
          targetId: regular.userId,
        }),
      ).rejects.toMatchObject({ status: 403, code: "NOT_OWNER" });

      await moderateCommunity(owner.actor, community.slug, {
        action: "ALLOW_MEMBER",
        targetId: regular.userId,
      });
      await joinCommunity(regular.actor, community.slug);
      expect((await getCommunityBySlug(regular.actor, community.slug)).myRole).toBe("MEMBER");

      await expect(
        moderateCommunity(owner.actor, community.slug, {
          action: "SET_ROLE",
          targetId: regular.userId,
          role: "OWNER",
        }),
      ).rejects.toMatchObject({ status: 422, code: "INVALID_TARGET" });
      await expect(
        moderateCommunity(moderator.actor, community.slug, {
          action: "SET_ROLE",
          targetId: regular.userId,
          role: "MODERATOR",
        }),
      ).rejects.toMatchObject({ status: 403, code: "NOT_OWNER" });
    });

    it("lets moderators delete posts too, and writes every action to a log without content", async () => {
      const { community, owner, moderator, regular } = await crew();
      const post = await createCommunityPost(regular.actor, community.slug, {
        body: "Secret words",
        mediaIds: [],
      });
      await moderateCommunity(moderator.actor, community.slug, {
        action: "HIDE_POST",
        targetId: post.id,
      });
      await deleteCommunityPost(moderator.actor, post.id, provider);

      const view = await getCommunityManageView(owner.actor, community.slug);
      expect(view.log.map((entry) => entry.action)).toEqual([
        "post.delete",
        "post.hide",
        "role.change",
      ]);
      expect(JSON.stringify(view.log)).not.toContain("Secret words");
      expect(view.log[0]?.actor?.displayName).toBe("Moderator");
      expect(view.memberCount).toBe(4);
      await expect(getCommunityManageView(regular.actor, community.slug)).rejects.toMatchObject({
        status: 403,
      });
    });

    it("deletes a community with its discussions and photos, for the owner only", async () => {
      const { community, owner, regular } = await crew();
      const photo = await createMedia({ ownerId: regular.userId });
      await createCommunityPost(regular.actor, community.slug, {
        body: "With photo",
        mediaIds: [photo.id],
      });

      await expect(deleteCommunity(regular.actor, community.slug, provider)).rejects.toMatchObject({
        status: 403,
      });
      await deleteCommunity(owner.actor, community.slug, provider);

      expect(await db.community.count()).toBe(0);
      expect(await db.communityPost.count()).toBe(0);
      expect(await db.mediaAsset.count({ where: { id: photo.id } })).toBe(0);
    });
  });

  describe("reports", () => {
    it("lets members report a community or a post, never their own, and moderators hide them", async () => {
      const { owner, community } = await setup();
      const ravi = await member();
      await joinCommunity(ravi.actor, community.slug);
      const post = await createCommunityPost(ravi.actor, community.slug, {
        body: "Spammy",
        mediaIds: [],
      });
      const staffUser = await db.user.create({
        data: { email: "mod-community@example.test", role: "MODERATOR", emailVerified: new Date() },
      });
      const staff = actorFor(staffUser, "MODERATOR");

      await expect(
        createReport(owner.actor, {
          targetType: "COMMUNITY",
          targetId: community.id,
          reason: "SPAM",
        }),
      ).rejects.toMatchObject({ code: "SELF_REPORT" });
      await expect(
        createReport(ravi.actor, {
          targetType: "COMMUNITY_POST",
          targetId: post.id,
          reason: "SPAM",
        }),
      ).rejects.toMatchObject({ code: "SELF_REPORT" });
      await createReport(owner.actor, {
        targetType: "COMMUNITY_POST",
        targetId: post.id,
        reason: "SPAM",
      });
      await createReport(ravi.actor, {
        targetType: "COMMUNITY",
        targetId: community.id,
        reason: "OTHER",
        note: "Not for me",
      });

      const groups = await listReportGroups(staff, { status: "OPEN" });
      expect(groups.items.map((group) => group.targetType).sort()).toEqual([
        "COMMUNITY",
        "COMMUNITY_POST",
      ]);
      const postGroup = groups.items.find((group) => group.targetType === "COMMUNITY_POST");
      expect(postGroup?.target).toMatchObject({ label: "Spammy", isHidden: false });

      await actOnReport(staff, postGroup?.reportId ?? "", { action: "HIDE_TARGET" });
      const stranger = await member();
      expect((await listCommunityPosts(stranger.actor, community.slug)).items).toEqual([]);

      const communityGroup = groups.items.find((group) => group.targetType === "COMMUNITY");
      await actOnReport(staff, communityGroup?.reportId ?? "", { action: "HIDE_TARGET" });
      await expect(getCommunityBySlug(stranger.actor, community.slug)).rejects.toMatchObject({
        status: 404,
      });
    });

    it("answers 404 for a hidden post or a stranger's unknown target", async () => {
      const { community } = await setup();
      const ravi = await member();
      await expect(
        createReport(ravi.actor, {
          targetType: "COMMUNITY_POST",
          targetId: "missing",
          reason: "SPAM",
        }),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        createReport(ravi.actor, {
          targetType: "COMMUNITY",
          targetId: `${community.id}x`,
          reason: "SPAM",
        }),
      ).rejects.toMatchObject({ status: 404 });
    });
  });

  describe("account deletion (COM-08)", () => {
    it("hands an owned community to its oldest moderator, deletes ones without a moderator, and deletes the member's posts", async () => {
      const { owner, skill, community } = await setup();
      const alone = await start(owner, skill.id, "Alone");
      const younger = await member({ name: "Younger" });
      const elder = await member({ name: "Elder" });
      const photo = await createMedia({ ownerId: owner.userId });
      await joinCommunity(elder.actor, community.slug);
      await joinCommunity(younger.actor, community.slug);
      for (const who of [elder, younger]) {
        await moderateCommunity(owner.actor, community.slug, {
          action: "SET_ROLE",
          targetId: who.userId,
          role: "MODERATOR",
        });
      }
      await db.communityMember.update({
        where: { communityId_userId: { communityId: community.id, userId: elder.userId } },
        data: { joinedAt: new Date(Date.now() - 86_400_000) },
      });
      const post = await createCommunityPost(owner.actor, community.slug, {
        body: "Owner's post",
        mediaIds: [photo.id],
      });
      await createCommunityPost(younger.actor, community.slug, {
        body: "Reply to the owner",
        mediaIds: [],
        parentId: post.id,
      });

      await db.user.update({
        where: { id: owner.userId },
        data: { deletionRequestedAt: new Date(Date.now() - 15 * 86_400_000) },
      });
      await deleteAccountsDue({ provider: createFakeMediaProvider() });

      const handed = await getCommunityBySlug(elder.actor, community.slug);
      expect(handed.myRole).toBe("OWNER");
      expect(await db.community.findUnique({ where: { id: alone.id } })).toBeNull();
      expect(await db.communityPost.count()).toBe(0);
      expect(await db.mediaAsset.count({ where: { id: photo.id } })).toBe(0);
      expect((await db.community.findUnique({ where: { id: community.id } }))?.createdById).toBe(
        elder.userId,
      );
    });
  });
});
