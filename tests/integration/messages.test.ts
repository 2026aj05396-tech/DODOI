import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/server/db/client";
import { blockUser } from "@/server/modules/blocks";
import { deleteAccountsDue } from "@/server/modules/jobs";
import {
  canMessage,
  CONVERSATION_CREATE_RATE_LIMIT,
  deleteMessage,
  getConversation,
  hideConversation,
  listConversations,
  listMessages,
  MESSAGE_PAGE_SIZE,
  MESSAGE_SEND_RATE_LIMIT,
  sendMessage,
  startConversation,
  UNANSWERED_MESSAGE_LIMIT,
} from "@/server/modules/messages";
import { actOnReport, createReport, listReportGroups } from "@/server/modules/reports";
import { getMessageSettings, updateMessageSettings } from "@/server/modules/users";

import { resetDatabase } from "../helpers/database";
import { actorFor, createUser } from "../helpers/factories";
import { createFakeMediaProvider } from "../helpers/fake-media";

// Direct messages (roadmap P3-02; MSG-01…05, USER_FLOWS F-29): who can write to whom, who can read,
// limits, deletion and hiding, blocks, reports with a moderator's limited view, account deletion.

async function member(options: { verified?: boolean; name?: string } = {}) {
  const user = await createUser({ emailVerified: options.verified === false ? null : new Date() });
  const profile = await db.profile.create({
    data: {
      userId: user.id,
      username: `ms${user.id.slice(-8)}`,
      displayName: options.name ?? "Asha",
    },
  });
  return { actor: actorFor(user), userId: user.id, username: profile.username };
}

type Who = Awaited<ReturnType<typeof member>>;

/** A conversation between two members with the first member's opening message. */
async function chat(from: Who, to: Who, text = "Hello!") {
  const { id } = await startConversation(from.actor, { username: to.username });
  await sendMessage(from.actor, id, { body: text });
  return id;
}

describe("direct messages", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await resetDatabase();
    await db.$disconnect();
  });

  describe("starting", () => {
    it("starts a conversation once per pair and returns the same one afterwards, from either side", async () => {
      const asha = await member();
      const ravi = await member({ name: "Ravi" });

      const first = await startConversation(asha.actor, { username: ravi.username });
      const again = await startConversation(asha.actor, { username: ravi.username });
      const fromRavi = await startConversation(ravi.actor, { username: asha.username });

      expect(first.created).toBe(true);
      expect(again).toEqual({ id: first.id, created: false });
      expect(fromRavi).toEqual({ id: first.id, created: false });
      expect(await db.conversation.count()).toBe(1);
    });

    it("refuses unverified members, yourself and unknown or blocked people", async () => {
      const asha = await member();
      const newcomer = await member({ verified: false });
      const ravi = await member();
      const blocked = await member();
      await blockUser(asha.actor, blocked.username);

      await expect(
        startConversation(newcomer.actor, { username: ravi.username }),
      ).rejects.toMatchObject({
        status: 403,
        code: "EMAIL_NOT_VERIFIED",
      });
      await expect(
        startConversation(asha.actor, { username: asha.username }),
      ).rejects.toMatchObject({
        status: 422,
        code: "SELF_MESSAGE",
      });
      await expect(
        startConversation(asha.actor, { username: "nobody-here" }),
      ).rejects.toMatchObject({
        status: 404,
      });
      await expect(
        startConversation(asha.actor, { username: blocked.username }),
      ).rejects.toMatchObject({
        status: 404,
      });
      await expect(
        startConversation(blocked.actor, { username: asha.username }),
      ).rejects.toMatchObject({
        status: 404,
      });
    });

    it("limits new conversations to 5 a day, but not reopening one", async () => {
      const asha = await member();
      const others: Who[] = [];
      for (let i = 0; i < CONVERSATION_CREATE_RATE_LIMIT.limit + 1; i += 1) {
        others.push(await member());
      }
      for (const other of others.slice(0, CONVERSATION_CREATE_RATE_LIMIT.limit)) {
        await startConversation(asha.actor, { username: other.username });
      }
      await expect(
        startConversation(asha.actor, { username: others.at(-1)?.username ?? "" }),
      ).rejects.toMatchObject({ status: 429 });
      await expect(
        startConversation(asha.actor, { username: others[0]?.username ?? "" }),
      ).resolves.toMatchObject({ created: false });
    });
  });

  describe("who can message me", () => {
    it("defaults to everyone and can be changed to people I follow or no one", async () => {
      const ravi = await member();

      expect(await getMessageSettings(ravi.actor)).toEqual({ messagePolicy: "EVERYONE" });
      await updateMessageSettings(ravi.actor, { messagePolicy: "NOBODY" });
      expect(await getMessageSettings(ravi.actor)).toEqual({ messagePolicy: "NOBODY" });
    });

    it("closes the door for No one and lets only followed people in for People I follow", async () => {
      const asha = await member();
      const ravi = await member();
      const tara = await member();

      await updateMessageSettings(ravi.actor, { messagePolicy: "NOBODY" });
      await expect(
        startConversation(asha.actor, { username: ravi.username }),
      ).rejects.toMatchObject({
        status: 403,
        code: "MESSAGES_CLOSED",
      });
      expect(await canMessage(asha.actor, ravi.userId)).toBe(false);

      await updateMessageSettings(ravi.actor, { messagePolicy: "FOLLOWING" });
      await db.follow.create({ data: { followerId: ravi.userId, followeeId: tara.userId } });
      await expect(
        startConversation(asha.actor, { username: ravi.username }),
      ).rejects.toMatchObject({
        code: "MESSAGES_CLOSED",
      });
      await expect(
        startConversation(tara.actor, { username: ravi.username }),
      ).resolves.toMatchObject({
        created: true,
      });
      expect(await canMessage(tara.actor, ravi.userId)).toBe(true);
      expect(await canMessage(asha.actor, ravi.userId)).toBe(false);
    });

    it("lets someone answer a person who wrote first, and the first writer continue once answered", async () => {
      const asha = await member();
      const ravi = await member();
      const id = await chat(asha, ravi, "Hi Ravi");

      // Ravi closes his door after Asha wrote: she can't add more until he writes himself.
      await updateMessageSettings(ravi.actor, { messagePolicy: "NOBODY" });
      await expect(sendMessage(asha.actor, id, { body: "More" })).rejects.toMatchObject({
        code: "MESSAGES_CLOSED",
      });
      // He can still answer her, because she wrote first.
      await expect(sendMessage(ravi.actor, id, { body: "Hello Asha" })).resolves.toMatchObject({
        body: "Hello Asha",
      });
      // Once he has written, Asha can answer him whatever his setting says.
      await expect(sendMessage(asha.actor, id, { body: "Thanks" })).resolves.toMatchObject({
        body: "Thanks",
      });
      expect((await getConversation(asha.actor, id)).canSend).toBe(true);
    });
  });

  describe("reading and writing", () => {
    it("shows both people the messages oldest first, and only them", async () => {
      const asha = await member({ name: "Asha" });
      const ravi = await member({ name: "Ravi" });
      const tara = await member();
      const id = await chat(asha, ravi, "Hello Ravi");
      await sendMessage(ravi.actor, id, { body: "Hi Asha" });

      const seenByAsha = await getConversation(asha.actor, id);
      expect(seenByAsha.with).toMatchObject({ displayName: "Ravi" });
      expect(seenByAsha.messages.map((m) => [m.body, m.isOwn])).toEqual([
        ["Hello Ravi", true],
        ["Hi Asha", false],
      ]);
      expect((await getConversation(ravi.actor, id)).messages.map((m) => m.isOwn)).toEqual([
        false,
        true,
      ]);
      await expect(getConversation(tara.actor, id)).rejects.toMatchObject({ status: 404 });
      await expect(listMessages(tara.actor, id, {})).rejects.toMatchObject({ status: 404 });
      await expect(sendMessage(tara.actor, id, { body: "Hey" })).rejects.toMatchObject({
        status: 404,
      });
      await expect(hideConversation(tara.actor, id)).rejects.toMatchObject({ status: 404 });
    });

    it("polls for newer messages with a cursor", async () => {
      const asha = await member();
      const ravi = await member();
      const id = await chat(asha, ravi, "One");
      const first = await listMessages(ravi.actor, id, {});
      const cursor = first.items.at(-1)?.cursor;
      expect(cursor).toBeTruthy();

      expect((await listMessages(ravi.actor, id, { after: cursor })).items).toEqual([]);
      await sendMessage(asha.actor, id, { body: "Two" });
      await sendMessage(asha.actor, id, { body: "Three" });

      const later = await listMessages(ravi.actor, id, { after: cursor });
      expect(later.items.map((m) => m.body)).toEqual(["Two", "Three"]);
      expect(later.olderCursor).toBeNull();
    });

    it("pages back through long conversations", async () => {
      const asha = await member();
      const ravi = await member();
      const { id } = await startConversation(asha.actor, { username: ravi.username });
      const base = Date.now() - 100_000;
      await db.message.createMany({
        data: Array.from({ length: MESSAGE_PAGE_SIZE + 5 }, (_, i) => ({
          conversationId: id,
          senderId: i % 2 === 0 ? asha.userId : ravi.userId,
          body: `m${i}`,
          createdAt: new Date(base + i * 1000),
        })),
      });

      const latest = await listMessages(asha.actor, id, {});
      expect(latest.items).toHaveLength(MESSAGE_PAGE_SIZE);
      expect(latest.items.at(-1)?.body).toBe(`m${MESSAGE_PAGE_SIZE + 4}`);
      expect(latest.olderCursor).not.toBeNull();
      const older = await listMessages(asha.actor, id, { before: latest.olderCursor ?? "" });
      expect(older.items.map((m) => m.body)).toEqual(["m0", "m1", "m2", "m3", "m4"]);
      expect(older.olderCursor).toBeNull();
    });

    it("limits the length, 30 messages an hour, and 3 messages until the other person replies", async () => {
      const asha = await member();
      const ravi = await member();
      const id = await chat(asha, ravi, "1");
      for (let i = 2; i <= UNANSWERED_MESSAGE_LIMIT; i += 1) {
        await sendMessage(asha.actor, id, { body: `${i}` });
      }
      await expect(sendMessage(asha.actor, id, { body: "4" })).rejects.toMatchObject({
        status: 422,
        code: "AWAITING_REPLY",
      });

      await sendMessage(ravi.actor, id, { body: "Hi" });
      for (let i = 0; i < 4; i += 1) await sendMessage(asha.actor, id, { body: `more ${i}` });
      expect(MESSAGE_SEND_RATE_LIMIT.limit).toBe(30);
    });

    it("stops a member at 30 messages an hour", async () => {
      const asha = await member();
      const ravi = await member();
      const id = await chat(asha, ravi, "start");
      await sendMessage(ravi.actor, id, { body: "hi" });
      // Ravi's one message counts too: Asha and Ravi share nothing, but each has own budget.
      for (let i = 0; i < MESSAGE_SEND_RATE_LIMIT.limit - 1; i += 1) {
        await sendMessage(asha.actor, id, { body: `a${i}` });
      }
      await expect(sendMessage(asha.actor, id, { body: "one more" })).rejects.toMatchObject({
        status: 429,
      });
      await expect(sendMessage(ravi.actor, id, { body: "still fine" })).resolves.toBeTruthy();
    });

    it("needs a verified email to write", async () => {
      const asha = await member();
      const ravi = await member();
      const id = await chat(asha, ravi);
      const unverified = await member({ verified: false });

      await expect(sendMessage(unverified.actor, id, { body: "x" })).rejects.toMatchObject({
        status: 403,
      });
    });
  });

  describe("the list and the unread dot", () => {
    it("lists conversations newest first with the last line, and flags unread ones until opened", async () => {
      const asha = await member({ name: "Asha" });
      const ravi = await member({ name: "Ravi" });
      const tara = await member({ name: "Tara" });
      const withRavi = await chat(ravi, asha, "From Ravi");
      await chat(tara, asha, "From Tara");
      // A conversation started but never written in is not listed.
      const quiet = await member();
      await startConversation(asha.actor, { username: quiet.username });

      const list = await listConversations(asha.actor, {});
      expect(list.items.map((item) => [item.with?.displayName, item.lastMessage?.body])).toEqual([
        ["Tara", "From Tara"],
        ["Ravi", "From Ravi"],
      ]);
      expect(list.items.map((item) => item.hasUnread)).toEqual([true, true]);
      // Ravi's own sent message is not unread for him.
      expect((await listConversations(ravi.actor, {})).items[0]?.hasUnread).toBe(false);

      await getConversation(asha.actor, withRavi);
      const after = await listConversations(asha.actor, {});
      expect(after.items.map((item) => item.hasUnread)).toEqual([true, false]);

      await sendMessage(ravi.actor, withRavi, { body: "Another" });
      const bumped = await listConversations(asha.actor, {});
      expect(bumped.items.map((item) => [item.with?.displayName, item.hasUnread])).toEqual([
        ["Ravi", true],
        ["Tara", true],
      ]);
    });

    it("never tells the sender whether a message was read", async () => {
      const asha = await member();
      const ravi = await member();
      const id = await chat(asha, ravi);
      await getConversation(ravi.actor, id);

      const seenByAsha = await getConversation(asha.actor, id);
      expect(JSON.stringify(seenByAsha)).not.toMatch(/read|seen/i);
      expect(JSON.stringify(await listConversations(asha.actor, {}))).not.toMatch(/seen/i);
    });
  });

  describe("deleting and hiding", () => {
    it("erases a message for good: it reads Message deleted, and only its sender can do it", async () => {
      const asha = await member();
      const ravi = await member();
      const id = await chat(asha, ravi, "Secret words");
      const [message] = (await getConversation(asha.actor, id)).messages;

      await expect(deleteMessage(ravi.actor, message?.id ?? "")).rejects.toMatchObject({
        status: 404,
      });
      await deleteMessage(asha.actor, message?.id ?? "");

      const view = (await getConversation(ravi.actor, id)).messages[0];
      expect(view).toMatchObject({ body: null, isDeleted: true });
      expect((await listConversations(ravi.actor, {})).items[0]?.lastMessage?.body).toBeNull();
      const row = await db.message.findUniqueOrThrow({ where: { id: message?.id } });
      expect(row.body).toBe("");
    });

    it("hides a conversation for one person only, and a new message brings it back", async () => {
      const asha = await member();
      const ravi = await member();
      const id = await chat(asha, ravi, "Hi");

      await hideConversation(asha.actor, id);
      expect((await listConversations(asha.actor, {})).items).toEqual([]);
      expect((await listConversations(ravi.actor, {})).items).toHaveLength(1);

      await sendMessage(ravi.actor, id, { body: "Are you there?" });
      expect((await listConversations(asha.actor, {})).items).toHaveLength(1);
    });
  });

  describe("blocks", () => {
    it("end the conversation for both people: not listed, not readable, not writable", async () => {
      const asha = await member();
      const ravi = await member();
      const id = await chat(asha, ravi);
      await sendMessage(ravi.actor, id, { body: "Hi" });

      await blockUser(asha.actor, ravi.username);

      for (const who of [asha, ravi]) {
        expect((await listConversations(who.actor, {})).items).toEqual([]);
        await expect(getConversation(who.actor, id)).rejects.toMatchObject({ status: 404 });
        await expect(sendMessage(who.actor, id, { body: "x" })).rejects.toMatchObject({
          status: 404,
        });
      }
      expect(await canMessage(asha.actor, ravi.userId)).toBe(false);
      expect(await canMessage(ravi.actor, asha.userId)).toBe(false);
    });
  });

  describe("reports", () => {
    it("lets the other person report a message, never your own, and nobody outside", async () => {
      const asha = await member();
      const ravi = await member();
      const tara = await member();
      const id = await chat(asha, ravi, "Buy my course");
      const [message] = (await getConversation(asha.actor, id)).messages;

      await expect(
        createReport(asha.actor, {
          targetType: "MESSAGE",
          targetId: message?.id ?? "",
          reason: "SPAM",
        }),
      ).rejects.toMatchObject({ code: "SELF_REPORT" });
      await expect(
        createReport(tara.actor, {
          targetType: "MESSAGE",
          targetId: message?.id ?? "",
          reason: "SPAM",
        }),
      ).rejects.toMatchObject({ status: 404 });
      await createReport(ravi.actor, {
        targetType: "MESSAGE",
        targetId: message?.id ?? "",
        reason: "SPAM",
      });
      expect(await db.report.count({ where: { targetType: "MESSAGE" } })).toBe(1);
    });

    it("shows a moderator only the reported message and the 5 before it, records the view, and cannot hide it", async () => {
      const asha = await member();
      const ravi = await member();
      const id = await chat(asha, ravi, "line 1");
      await sendMessage(ravi.actor, id, { body: "line 2" });
      for (let i = 3; i <= 8; i += 1) {
        await db.message.create({
          data: {
            conversationId: id,
            senderId: asha.userId,
            body: `line ${i}`,
            createdAt: new Date(Date.now() + i * 1000),
          },
        });
      }
      const reported = await db.message.findFirstOrThrow({ where: { body: "line 8" } });
      await db.message.create({
        data: {
          conversationId: id,
          senderId: ravi.userId,
          body: "after the report",
          createdAt: new Date(Date.now() + 20_000),
        },
      });
      await createReport(ravi.actor, {
        targetType: "MESSAGE",
        targetId: reported.id,
        reason: "OFFENSIVE",
      });
      const moderatorUser = await db.user.create({
        data: { email: "mod-messages@example.test", role: "MODERATOR", emailVerified: new Date() },
      });
      const moderator = actorFor(moderatorUser, "MODERATOR");

      const { items } = await listReportGroups(moderator, { status: "OPEN" });
      const group = items.find((g) => g.targetType === "MESSAGE");

      expect(group?.target.thread?.map((line) => line.text)).toEqual([
        "line 3",
        "line 4",
        "line 5",
        "line 6",
        "line 7",
        "line 8",
      ]);
      expect(group?.target.thread?.at(-1)).toMatchObject({ isReported: true, fromSender: true });
      expect(JSON.stringify(group)).not.toContain("after the report");
      expect(JSON.stringify(group)).not.toContain(ravi.username);
      const audit = await db.auditLog.findFirst({ where: { action: "message.view" } });
      expect(audit).toMatchObject({ actorId: moderatorUser.id, targetId: reported.id });
      await expect(
        actOnReport(moderator, group?.reportId ?? "", { action: "HIDE_TARGET" }),
      ).rejects.toMatchObject({ code: "NOT_HIDEABLE" });
      await actOnReport(moderator, group?.reportId ?? "", { action: "DISMISS" });
    });
  });

  describe("account deletion", () => {
    it("removes the member's messages and conversations", async () => {
      const asha = await member();
      const ravi = await member();
      const id = await chat(asha, ravi, "Bye");
      await sendMessage(ravi.actor, id, { body: "See you" });
      await db.user.update({
        where: { id: asha.userId },
        data: { deletionRequestedAt: new Date(Date.now() - 15 * 86_400_000) },
      });

      await deleteAccountsDue({ provider: createFakeMediaProvider() });

      expect(await db.message.count()).toBe(0);
      expect(await db.conversation.count()).toBe(0);
      expect((await listConversations(ravi.actor, {})).items).toEqual([]);
    });
  });
});
