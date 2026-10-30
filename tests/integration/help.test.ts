import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/server/db/client";
import { blockUser } from "@/server/modules/blocks";
import { getFeed } from "@/server/modules/feed";
import {
  createHelpRequest,
  createHelpResponse,
  deleteHelpRequest,
  getHelpRequest,
  getMatchingHelpRequests,
  HELP_REQUEST_RATE_LIMIT,
  HELP_RESPONSE_RATE_LIMIT,
  listHelpRequests,
  setHelpRequestStatus,
  setResponseHelpful,
} from "@/server/modules/help";
import { listNotifications, updateNotificationPreferences } from "@/server/modules/notifications";
import { actOnReport, createReport, listReportGroups } from "@/server/modules/reports";

import { resetDatabase } from "../helpers/database";
import { actorFor, createMedia, createSkill, createUser } from "../helpers/factories";
import { createFakeMediaProvider } from "../helpers/fake-media";

// Help requests (roadmap P3-03; HLP-01…06, USER_FLOWS F-27): who can ask and answer, what the list
// shows each member, who may change a request, notifications, blocks, reports and cleanup.

const DAY_MS = 24 * 60 * 60 * 1000;
const provider = { provider: createFakeMediaProvider() };

async function member(options: { verified?: boolean; name?: string } = {}) {
  const user = await createUser({ emailVerified: options.verified === false ? null : new Date() });
  const profile = await db.profile.create({
    data: {
      userId: user.id,
      username: `hp${user.id.slice(-8)}`,
      displayName: options.name ?? "Asha",
    },
  });
  return { actor: actorFor(user), userId: user.id, username: profile.username };
}

async function ask(
  who: { actor: ReturnType<typeof actorFor> },
  skillId: string,
  overrides: Partial<{ title: string; body: string; mediaIds: string[] }> = {},
) {
  return createHelpRequest(who.actor, {
    title: overrides.title ?? "Why is my sky blotchy?",
    body: overrides.body ?? "The wash dries in patches.",
    skillId,
    mediaIds: overrides.mediaIds ?? [],
  });
}

describe("help requests", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await resetDatabase();
    await db.$disconnect();
  });

  it("lets a verified member ask with a skill and their own photos, and shows it to others", async () => {
    const asha = await member();
    const ravi = await member({ name: "Ravi" });
    const watercolor = await createSkill("Watercolor");
    const photo = await createMedia({ ownerId: asha.userId });

    const request = await ask(asha, watercolor.id, { mediaIds: [photo.id] });

    expect(request).toMatchObject({
      title: "Why is my sky blotchy?",
      status: "OPEN",
      isOwn: true,
      canRespond: false,
      responseCount: 0,
      skill: { name: "Watercolor" },
    });
    expect(request.photos).toHaveLength(1);
    const seen = await getHelpRequest(ravi.actor, request.id);
    expect(seen).toMatchObject({ isOwn: false, canRespond: true, author: { displayName: "Asha" } });
  });

  it("refuses unverified members, unavailable skills, other people's photos and a sixth request a day", async () => {
    const asha = await member();
    const newcomer = await member({ verified: false });
    const watercolor = await createSkill("Watercolor");
    const hidden = await createSkill("Hidden craft", { status: "HIDDEN" });
    const strangers = await createMedia({ ownerId: (await member()).userId });

    await expect(ask(newcomer, watercolor.id)).rejects.toMatchObject({
      status: 403,
      code: "EMAIL_NOT_VERIFIED",
    });
    await expect(ask(asha, hidden.id)).rejects.toMatchObject({ status: 400 });
    await expect(ask(asha, watercolor.id, { mediaIds: [strangers.id] })).rejects.toMatchObject({
      status: 400,
    });
    for (let i = 0; i < HELP_REQUEST_RATE_LIMIT.limit; i += 1) await ask(asha, watercolor.id);
    await expect(ask(asha, watercolor.id)).rejects.toMatchObject({ status: 429 });
  });

  it("lists open requests newest first, with filters, my own, matching skills, and leaves out hidden, blocked and idle ones", async () => {
    const asha = await member();
    const ravi = await member({ name: "Ravi" });
    const tara = await member({ name: "Tara" });
    const watercolor = await createSkill("Watercolor");
    const crochet = await createSkill("Crochet");
    await db.userSkill.create({
      data: { userId: ravi.userId, skillId: watercolor.id, canHelp: true },
    });

    const first = await ask(asha, watercolor.id, { title: "First" });
    const second = await ask(asha, crochet.id, { title: "Second" });
    const mine = await ask(ravi, watercolor.id, { title: "Ravi's own" });
    const idle = await ask(asha, watercolor.id, { title: "Idle" });
    await db.helpRequest.update({
      where: { id: idle.id },
      data: { updatedAt: new Date(Date.now() - 91 * DAY_MS) },
    });
    const hiddenOne = await ask(asha, watercolor.id, { title: "Hidden" });
    await db.helpRequest.update({ where: { id: hiddenOne.id }, data: { hiddenAt: new Date() } });
    await db.helpRequest.update({ where: { id: first.id }, data: { status: "RESOLVED" } });

    const open = await listHelpRequests(tara.actor, {});
    expect(open.items.map((item) => item.title)).toEqual(["Ravi's own", "Second"]);
    expect(
      (await listHelpRequests(tara.actor, { status: "RESOLVED" })).items.map((i) => i.title),
    ).toEqual(["First"]);
    expect(
      (await listHelpRequests(tara.actor, { skillId: crochet.id })).items.map((i) => i.id),
    ).toEqual([second.id]);
    expect((await listHelpRequests(ravi.actor, { mine: true })).items.map((i) => i.id)).toEqual([
      mine.id,
    ]);
    // Ravi can help with watercolor: others' open watercolor requests only, never his own.
    const matching = await listHelpRequests(ravi.actor, { matching: true });
    expect(matching.items.map((item) => item.title)).toEqual([]);
    await db.helpRequest.update({ where: { id: first.id }, data: { status: "OPEN" } });
    expect((await getMatchingHelpRequests(ravi.actor, 5)).map((item) => item.title)).toEqual([
      "First",
    ]);
    expect(await getMatchingHelpRequests(tara.actor, 5)).toEqual([]);

    await blockUser(tara.actor, asha.username);
    expect((await listHelpRequests(tara.actor, {})).items.map((i) => i.title)).toEqual([
      "Ravi's own",
    ]);
    await expect(getHelpRequest(tara.actor, second.id)).rejects.toMatchObject({ status: 404 });
  });

  it("pages the list with a cursor", async () => {
    const asha = await member();
    const watercolor = await createSkill("Watercolor");
    for (let i = 0; i < 23; i += 1) {
      await db.helpRequest.create({
        data: {
          authorId: asha.userId,
          skillId: watercolor.id,
          title: `Request ${i}`,
          body: "x",
          createdAt: new Date(Date.now() - i * 1000),
        },
      });
    }
    const reader = await member();
    const page1 = await listHelpRequests(reader.actor, {});
    expect(page1.items).toHaveLength(20);
    const page2 = await listHelpRequests(reader.actor, { cursor: page1.nextCursor ?? undefined });
    expect(page2.items).toHaveLength(3);
    expect(page2.nextCursor).toBeNull();
  });

  it("takes responses from other verified members, tells the asker, and refuses own, closed and unverified", async () => {
    const asha = await member();
    const ravi = await member({ name: "Ravi" });
    const newcomer = await member({ verified: false });
    const watercolor = await createSkill("Watercolor");
    const request = await ask(asha, watercolor.id);

    const answered = await createHelpResponse(ravi.actor, request.id, {
      body: "Wet the paper first.",
    });
    expect(answered.responses).toMatchObject([{ body: "Wet the paper first.", isOwn: true }]);
    expect(answered.responseCount).toBe(1);

    const bell = await listNotifications(asha.actor, {});
    expect(bell.items[0]).toMatchObject({
      type: "HELP_RESPONSE",
      helpRequest: { id: request.id, title: "Why is my sky blotchy?" },
      actors: [{ displayName: "Ravi" }],
    });

    await expect(
      createHelpResponse(asha.actor, request.id, { body: "Mine" }),
    ).rejects.toMatchObject({
      status: 422,
      code: "OWN_REQUEST",
    });
    await expect(
      createHelpResponse(newcomer.actor, request.id, { body: "Hi" }),
    ).rejects.toMatchObject({
      status: 403,
    });
    await setHelpRequestStatus(asha.actor, request.id, "RESOLVED");
    await expect(
      createHelpResponse(ravi.actor, request.id, { body: "More" }),
    ).rejects.toMatchObject({
      status: 422,
      code: "REQUEST_CLOSED",
    });
  });

  it("limits responses to 30 a day", async () => {
    const asha = await member();
    const ravi = await member();
    const watercolor = await createSkill("Watercolor");
    const request = await ask(asha, watercolor.id);
    for (let i = 0; i < HELP_RESPONSE_RATE_LIMIT.limit; i += 1) {
      await createHelpResponse(ravi.actor, request.id, { body: `Tip ${i}` });
    }
    await expect(
      createHelpResponse(ravi.actor, request.id, { body: "One more" }),
    ).rejects.toMatchObject({
      status: 429,
    });
  });

  it("lets only the asker change the status, tells helpers when it is resolved, and allows reopening", async () => {
    const asha = await member();
    const ravi = await member({ name: "Ravi" });
    const tara = await member({ name: "Tara" });
    const watercolor = await createSkill("Watercolor");
    const request = await ask(asha, watercolor.id);
    await createHelpResponse(ravi.actor, request.id, { body: "Tip" });
    await createHelpResponse(ravi.actor, request.id, { body: "Another tip" });

    await expect(setHelpRequestStatus(ravi.actor, request.id, "RESOLVED")).rejects.toMatchObject({
      status: 404,
    });
    expect((await setHelpRequestStatus(asha.actor, request.id, "IN_PROGRESS")).status).toBe(
      "IN_PROGRESS",
    );
    expect((await setHelpRequestStatus(asha.actor, request.id, "RESOLVED")).status).toBe(
      "RESOLVED",
    );

    const raviBell = (await listNotifications(ravi.actor, {})).items.filter(
      (i) => i.type === "HELP_RESOLVED",
    );
    expect(raviBell).toHaveLength(1);
    expect((await listNotifications(tara.actor, {})).items).toHaveLength(0);

    const reopened = await setHelpRequestStatus(asha.actor, request.id, "OPEN");
    expect(reopened.status).toBe("OPEN");
    expect(
      await db.helpRequest.findUnique({ where: { id: request.id }, select: { resolvedAt: true } }),
    ).toEqual({
      resolvedAt: null,
    });
  });

  it("lets only the asker mark a response helpful, never their own, and thanks the helper once", async () => {
    const asha = await member();
    const ravi = await member({ name: "Ravi" });
    const watercolor = await createSkill("Watercolor");
    const request = await ask(asha, watercolor.id);
    const withReply = await createHelpResponse(ravi.actor, request.id, { body: "Tip" });
    const responseId = withReply.responses[0]?.id ?? "";

    await expect(setResponseHelpful(ravi.actor, responseId, true)).rejects.toMatchObject({
      status: 404,
    });
    await setResponseHelpful(asha.actor, responseId, true);
    await setResponseHelpful(asha.actor, responseId, true);
    expect((await getHelpRequest(asha.actor, request.id)).responses[0]?.isHelpful).toBe(true);
    const thanks = (await listNotifications(ravi.actor, {})).items.filter(
      (i) => i.type === "HELP_HELPFUL",
    );
    expect(thanks).toHaveLength(1);

    await setResponseHelpful(asha.actor, responseId, false);
    expect((await getHelpRequest(asha.actor, request.id)).responses[0]?.isHelpful).toBe(false);
  });

  it("respects notification preferences and never notifies about your own response", async () => {
    const asha = await member();
    const ravi = await member();
    const watercolor = await createSkill("Watercolor");
    const request = await ask(asha, watercolor.id);
    await updateNotificationPreferences(asha.actor, { HELP_RESPONSE: false });

    await createHelpResponse(ravi.actor, request.id, { body: "Tip" });

    expect((await listNotifications(asha.actor, {})).items).toHaveLength(0);
  });

  it("hides a hidden request from everyone but its asker, and drops responses from blocked people", async () => {
    const asha = await member();
    const ravi = await member();
    const tara = await member();
    const watercolor = await createSkill("Watercolor");
    const request = await ask(asha, watercolor.id);
    await createHelpResponse(ravi.actor, request.id, { body: "From Ravi" });
    await createHelpResponse(tara.actor, request.id, { body: "From Tara" });

    await blockUser(asha.actor, ravi.username);
    expect((await getHelpRequest(asha.actor, request.id)).responses.map((r) => r.body)).toEqual([
      "From Tara",
    ]);

    await db.helpRequest.update({ where: { id: request.id }, data: { hiddenAt: new Date() } });
    await expect(getHelpRequest(tara.actor, request.id)).rejects.toMatchObject({ status: 404 });
    await expect(
      createHelpResponse(tara.actor, request.id, { body: "Late" }),
    ).rejects.toMatchObject({ status: 404 });
    expect((await getHelpRequest(asha.actor, request.id)).isHidden).toBe(true);
  });

  it("deletes a request with its responses and photos, only for the asker", async () => {
    const asha = await member();
    const ravi = await member();
    const watercolor = await createSkill("Watercolor");
    const photo = await createMedia({ ownerId: asha.userId });
    const request = await ask(asha, watercolor.id, { mediaIds: [photo.id] });
    await createHelpResponse(ravi.actor, request.id, { body: "Tip" });

    await expect(deleteHelpRequest(ravi.actor, request.id, provider)).rejects.toMatchObject({
      status: 404,
    });
    await deleteHelpRequest(asha.actor, request.id, provider);

    expect(await db.helpRequest.count()).toBe(0);
    expect(await db.helpResponse.count()).toBe(0);
    expect(await db.mediaAsset.count({ where: { id: photo.id } })).toBe(0);
  });

  it("can be reported (not your own), shows moderators the text, can be hidden and shown again", async () => {
    const asha = await member();
    const ravi = await member();
    const watercolor = await createSkill("Watercolor");
    const moderatorUser = await db.user.create({
      data: { email: "mod-help@example.test", role: "MODERATOR", emailVerified: new Date() },
    });
    const moderator = actorFor(moderatorUser, "MODERATOR");
    const request = await ask(asha, watercolor.id, { title: "Spammy title" });
    const reply = (await createHelpResponse(ravi.actor, request.id, { body: "Buy my course" }))
      .responses[0];

    await expect(
      createReport(asha.actor, {
        targetType: "HELP_REQUEST",
        targetId: request.id,
        reason: "SPAM",
      }),
    ).rejects.toMatchObject({ status: 422, code: "SELF_REPORT" });
    await createReport(ravi.actor, {
      targetType: "HELP_REQUEST",
      targetId: request.id,
      reason: "SPAM",
    });
    await createReport(asha.actor, {
      targetType: "HELP_RESPONSE",
      targetId: reply?.id ?? "",
      reason: "SPAM",
    });
    await expect(
      createReport(ravi.actor, {
        targetType: "HELP_RESPONSE",
        targetId: reply?.id ?? "",
        reason: "SPAM",
      }),
    ).rejects.toMatchObject({ code: "SELF_REPORT" });

    const { items } = await listReportGroups(moderator, { status: "OPEN" });
    const requestGroup = items.find((g) => g.targetType === "HELP_REQUEST");
    const responseGroup = items.find((g) => g.targetType === "HELP_RESPONSE");
    expect(requestGroup?.target).toMatchObject({ label: "Spammy title", detail: "Help request" });
    expect(responseGroup?.target).toMatchObject({
      label: "Buy my course",
      detail: "Help response",
    });

    await actOnReport(moderator, requestGroup?.reportId ?? "", { action: "HIDE_TARGET" });
    await expect(getHelpRequest(ravi.actor, request.id)).rejects.toMatchObject({ status: 404 });
    await actOnReport(moderator, requestGroup?.reportId ?? "", { action: "RESTORE_TARGET" });
    await expect(getHelpRequest(ravi.actor, request.id)).resolves.toMatchObject({ id: request.id });

    await actOnReport(moderator, responseGroup?.reportId ?? "", { action: "HIDE_TARGET" });
    expect((await getHelpRequest(asha.actor, request.id)).responses).toHaveLength(0);
  });

  it("removes a member's requests and responses when their account is deleted", async () => {
    const asha = await member();
    const ravi = await member();
    const watercolor = await createSkill("Watercolor");
    const request = await ask(asha, watercolor.id);
    await createHelpResponse(ravi.actor, request.id, { body: "Tip" });

    await db.user.delete({ where: { id: ravi.userId } });
    expect(await db.helpResponse.count()).toBe(0);
    await db.user.delete({ where: { id: asha.userId } });
    expect(await db.helpRequest.count()).toBe(0);
  });

  it("puts one help request in the For you feed for makers who can help, never their own, one per page", async () => {
    const asha = await member();
    const ravi = await member({ name: "Ravi" });
    const tara = await member({ name: "Tara" });
    const watercolor = await createSkill("Watercolor");
    await db.userSkill.create({
      data: { userId: ravi.userId, skillId: watercolor.id, canHelp: true },
    });
    const newest = await ask(asha, watercolor.id, { title: "Newest question" });
    await ask(ravi, watercolor.id, { title: "Ravi's own" });

    const page = await getFeed(ravi.actor, { filter: "for-you", limit: 20 }, provider);
    const cards = page.items.filter((item) => item.kind === "help_request");
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ request: { id: newest.id } });

    const none = await getFeed(tara.actor, { filter: "for-you", limit: 20 }, provider);
    expect(none.items.some((item) => item.kind === "help_request")).toBe(false);
  });
});
