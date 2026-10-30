import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/server/db/client";
import { blockUser } from "@/server/modules/blocks";
import { createHelpRequest } from "@/server/modules/help";
import { listNotifications } from "@/server/modules/notifications";
import {
  ensureSessionReminders,
  getSession,
  listSessions,
  proposeSession,
  respondToSession,
  runSessionMaintenance,
  SESSION_LINK_TTL_MS,
  SESSION_OPEN_LIMIT,
} from "@/server/modules/sessions";

import { resetDatabase } from "../helpers/database";
import { actorFor, createSkill, createUser } from "../helpers/factories";

// Creative sessions (roadmap P3-04; SES-01…05, USER_FLOWS F-30): who can propose and answer, what
// each person sees (the link only once accepted), states worked out from time, reminders created on
// read, blocks, and the daily job.

const HOUR = 60 * 60 * 1000;
const NOW = new Date("2026-11-03T08:00:00.000Z");
const LINK = "https://meet.google.com/abc-defg-hij";
const at = (hoursFromNow: number) => new Date(NOW.getTime() + hoursFromNow * HOUR).toISOString();

async function member(options: { verified?: boolean; name?: string } = {}) {
  const user = await createUser({ emailVerified: options.verified === false ? null : new Date() });
  const profile = await db.profile.create({
    data: {
      userId: user.id,
      username: `ss${user.id.slice(-8)}`,
      displayName: options.name ?? "Asha",
    },
  });
  return { actor: actorFor(user), userId: user.id, username: profile.username };
}

type Who = Awaited<ReturnType<typeof member>>;

function propose(
  from: Who,
  to: Who,
  overrides: Partial<Parameters<typeof proposeSession>[1]> = {},
  now = NOW,
) {
  return proposeSession(
    from.actor,
    {
      inviteeUsername: to.username,
      startsAt: at(48),
      durationMin: 30,
      note: undefined,
      meetingUrl: LINK,
      ...overrides,
    },
    { now },
  );
}

async function notificationsOf(who: Who) {
  return (await listNotifications(who.actor, {})).items;
}

describe("creative sessions", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await resetDatabase();
    await db.$disconnect();
  });

  describe("proposing", () => {
    it("creates a proposal the other person is told about, and keeps the link private until accepted", async () => {
      const asha = await member({ name: "Asha" });
      const ravi = await member({ name: "Ravi" });

      const session = await propose(asha, ravi, { note: "Bring your hoop" });

      expect(session).toMatchObject({
        state: "PROPOSED",
        isProposer: true,
        durationMin: 30,
        note: "Bring your hoop",
        meetingUrl: null,
        canRespond: false,
        canCancel: true,
        other: { displayName: "Ravi" },
      });
      const seenByRavi = await getSession(ravi.actor, session.id, { now: NOW });
      expect(seenByRavi).toMatchObject({ isProposer: false, canRespond: true, meetingUrl: null });
      expect(await notificationsOf(ravi)).toMatchObject([
        { type: "SESSION_PROPOSED", session: { id: session.id } },
      ]);
    });

    it("refuses unverified members, yourself, unknown or blocked people, and times under an hour away", async () => {
      const asha = await member();
      const newcomer = await member({ verified: false });
      const ravi = await member();
      const blocked = await member();
      await blockUser(asha.actor, blocked.username);

      await expect(propose(newcomer, ravi)).rejects.toMatchObject({
        status: 403,
        code: "EMAIL_NOT_VERIFIED",
      });
      await expect(propose(asha, asha)).rejects.toMatchObject({ code: "SELF_SESSION" });
      await expect(propose(asha, ravi, { inviteeUsername: "nobody-here" })).rejects.toMatchObject({
        status: 404,
      });
      await expect(propose(asha, blocked)).rejects.toMatchObject({ status: 404 });
      await expect(propose(blocked, asha)).rejects.toMatchObject({ status: 404 });
      await expect(propose(asha, ravi, { startsAt: at(0.5) })).rejects.toMatchObject({
        code: "TOO_SOON",
      });
      await expect(propose(asha, ravi, { startsAt: at(-3) })).rejects.toMatchObject({
        code: "TOO_SOON",
      });
      await expect(propose(asha, ravi, { startsAt: at(1) })).resolves.toMatchObject({
        state: "PROPOSED",
      });
    });

    it("allows 5 proposals waiting for an answer, no more", async () => {
      const asha = await member();
      const ravi = await member();
      for (let i = 0; i < SESSION_OPEN_LIMIT; i += 1) await propose(asha, ravi);

      await expect(propose(asha, ravi)).rejects.toMatchObject({
        status: 422,
        code: "TOO_MANY_OPEN",
      });
      // Someone else's proposals do not count against Ravi.
      await expect(propose(ravi, asha)).resolves.toBeTruthy();
    });

    it("links a session to a help request only when it is one of the two people's own", async () => {
      const asha = await member();
      const ravi = await member();
      const tara = await member();
      const skill = await createSkill("Watercolor");
      const request = await createHelpRequest(asha.actor, {
        title: "Blotchy sky",
        body: "It dries in patches.",
        skillId: skill.id,
        mediaIds: [],
      });

      await expect(propose(ravi, asha, { helpRequestId: request.id })).resolves.toMatchObject({
        helpRequestId: request.id,
      });
      await expect(propose(ravi, tara, { helpRequestId: request.id })).rejects.toMatchObject({
        status: 404,
      });
      await expect(propose(ravi, asha, { helpRequestId: "missing" })).rejects.toMatchObject({
        status: 404,
      });
    });
  });

  describe("answering", () => {
    it("lets the invitee accept: both then see the link, the proposer is told, outsiders see nothing", async () => {
      const asha = await member({ name: "Asha" });
      const ravi = await member({ name: "Ravi" });
      const tara = await member();
      const { id } = await propose(asha, ravi);

      const accepted = await respondToSession(ravi.actor, id, { action: "ACCEPT" }, { now: NOW });

      expect(accepted).toMatchObject({ state: "ACCEPTED", meetingUrl: LINK, canRespond: false });
      expect((await getSession(asha.actor, id, { now: NOW })).meetingUrl).toBe(LINK);
      expect((await notificationsOf(asha))[0]).toMatchObject({ type: "SESSION_ACCEPTED" });
      await expect(getSession(tara.actor, id)).rejects.toMatchObject({ status: 404 });
      await expect(respondToSession(tara.actor, id, { action: "CANCEL" })).rejects.toMatchObject({
        status: 404,
      });
    });

    it("lets only the invitee accept, decline or suggest a time, and only while it waits", async () => {
      const asha = await member();
      const ravi = await member();
      const { id } = await propose(asha, ravi);

      for (const action of ["ACCEPT", "DECLINE"] as const) {
        await expect(
          respondToSession(asha.actor, id, { action }, { now: NOW }),
        ).rejects.toMatchObject({ status: 403, code: "NOT_INVITEE" });
      }
      await expect(
        respondToSession(asha.actor, id, { action: "RESCHEDULE", startsAt: at(60) }, { now: NOW }),
      ).rejects.toMatchObject({ code: "NOT_INVITEE" });
      await respondToSession(ravi.actor, id, { action: "DECLINE" }, { now: NOW });
      await expect(
        respondToSession(ravi.actor, id, { action: "ACCEPT" }, { now: NOW }),
      ).rejects.toMatchObject({ status: 422, code: "NOT_PENDING" });
    });

    it("declines: the proposer is told and the link is erased", async () => {
      const asha = await member();
      const ravi = await member();
      const { id } = await propose(asha, ravi);

      const declined = await respondToSession(ravi.actor, id, { action: "DECLINE" }, { now: NOW });

      expect(declined.state).toBe("DECLINED");
      expect((await notificationsOf(asha))[0]).toMatchObject({ type: "SESSION_DECLINED" });
      expect((await db.creativeSession.findUniqueOrThrow({ where: { id } })).meetingUrl).toBeNull();
    });

    it("turns 'suggest another time' into a new proposal back to the first person", async () => {
      const asha = await member({ name: "Asha" });
      const ravi = await member({ name: "Ravi" });
      const first = await propose(asha, ravi, { note: "Hoop tips" });

      const next = await respondToSession(
        ravi.actor,
        first.id,
        { action: "RESCHEDULE", startsAt: at(72) },
        { now: NOW },
      );

      expect(next).toMatchObject({
        state: "PROPOSED",
        isProposer: true,
        note: "Hoop tips",
        durationMin: 30,
        other: { displayName: "Asha" },
      });
      expect(next.id).not.toBe(first.id);
      const old = await db.creativeSession.findUniqueOrThrow({ where: { id: first.id } });
      expect(old.state).toBe("RESCHEDULED");
      expect(old.meetingUrl).toBeNull();
      const created = await db.creativeSession.findUniqueOrThrow({ where: { id: next.id } });
      expect(created).toMatchObject({
        replacesId: first.id,
        proposerId: ravi.userId,
        inviteeId: asha.userId,
        meetingUrl: LINK,
      });
      expect((await notificationsOf(asha))[0]).toMatchObject({
        type: "SESSION_RESCHEDULED",
        session: { id: next.id },
      });
      await expect(
        respondToSession(
          ravi.actor,
          first.id,
          { action: "RESCHEDULE", startsAt: at(0.2) },
          { now: NOW },
        ),
      ).rejects.toMatchObject({ code: "NOT_PENDING" });
    });

    it("lets either person cancel until it ends; the other is told and the link goes", async () => {
      const asha = await member();
      const ravi = await member();
      const { id } = await propose(asha, ravi);
      await respondToSession(ravi.actor, id, { action: "ACCEPT" }, { now: NOW });

      const cancelled = await respondToSession(ravi.actor, id, { action: "CANCEL" }, { now: NOW });

      expect(cancelled).toMatchObject({ state: "CANCELLED", meetingUrl: null, canCancel: false });
      expect((await notificationsOf(asha))[0]).toMatchObject({ type: "SESSION_CANCELLED" });
      await expect(
        respondToSession(asha.actor, id, { action: "CANCEL" }, { now: NOW }),
      ).rejects.toMatchObject({ code: "NOT_CANCELLABLE" });

      const later = await propose(asha, ravi);
      const ended = new Date(NOW.getTime() + 49 * HOUR);
      await respondToSession(ravi.actor, later.id, { action: "ACCEPT" }, { now: NOW });
      await expect(
        respondToSession(asha.actor, later.id, { action: "CANCEL" }, { now: ended }),
      ).rejects.toMatchObject({ code: "NOT_CANCELLABLE" });
    });
  });

  describe("time", () => {
    it("shows an ended accepted session as Completed with its link for 24 hours, then without it", async () => {
      const asha = await member();
      const ravi = await member();
      const { id } = await propose(asha, ravi, { startsAt: at(2) });
      await respondToSession(ravi.actor, id, { action: "ACCEPT" }, { now: NOW });
      const end = NOW.getTime() + 2.5 * HOUR;

      const during = await getSession(asha.actor, id, {
        now: new Date(NOW.getTime() + 2.2 * HOUR),
      });
      expect(during).toMatchObject({ state: "ACCEPTED", canCancel: true });
      const done = await getSession(asha.actor, id, { now: new Date(end + HOUR) });
      expect(done).toMatchObject({ state: "COMPLETED", meetingUrl: LINK, canCancel: false });
      const stale = await getSession(asha.actor, id, {
        now: new Date(end + SESSION_LINK_TTL_MS + 1000),
      });
      expect(stale).toMatchObject({ state: "COMPLETED", meetingUrl: null });
    });

    it("shows a proposal nobody answered before it started as Cancelled and cannot be accepted", async () => {
      const asha = await member();
      const ravi = await member();
      const { id } = await propose(asha, ravi, { startsAt: at(2) });
      const after = new Date(NOW.getTime() + 3 * HOUR);

      expect((await getSession(ravi.actor, id, { now: after })).state).toBe("CANCELLED");
      await expect(
        respondToSession(ravi.actor, id, { action: "ACCEPT" }, { now: after }),
      ).rejects.toMatchObject({ code: "NOT_PENDING" });
    });

    it("lists upcoming sessions soonest first and past ones newest first, without blocked people", async () => {
      const asha = await member();
      const ravi = await member();
      const tara = await member();
      const later = await propose(asha, ravi, { startsAt: at(96) });
      const sooner = await propose(ravi, asha, { startsAt: at(24) });
      const declined = await propose(asha, ravi, { startsAt: at(30) });
      await respondToSession(ravi.actor, declined.id, { action: "DECLINE" }, { now: NOW });
      const hidden = await propose(asha, tara, { startsAt: at(10) });
      await blockUser(tara.actor, asha.username);

      const upcoming = await listSessions(asha.actor, { scope: "upcoming" }, { now: NOW });
      expect(upcoming.items.map((item) => item.id)).toEqual([sooner.id, later.id]);
      const past = await listSessions(asha.actor, { scope: "past" }, { now: NOW });
      expect(past.items.map((item) => item.id)).toEqual([declined.id]);
      expect([...upcoming.items, ...past.items].map((item) => item.id)).not.toContain(hidden.id);
    });
  });

  describe("blocks", () => {
    it("cancel what is still open between the two people", async () => {
      const asha = await member();
      const ravi = await member();
      const open = await propose(asha, ravi, { startsAt: at(40) });
      const accepted = await propose(ravi, asha, { startsAt: at(50) });
      await respondToSession(asha.actor, accepted.id, { action: "ACCEPT" }, { now: NOW });

      await blockUser(asha.actor, ravi.username);

      for (const id of [open.id, accepted.id]) {
        const row = await db.creativeSession.findUniqueOrThrow({ where: { id } });
        expect(row).toMatchObject({ state: "CANCELLED", meetingUrl: null });
      }
      await expect(getSession(asha.actor, open.id)).rejects.toMatchObject({ status: 404 });
    });
  });

  describe("reminders", () => {
    it("are made once for both people when an accepted session is within the hour, on read", async () => {
      const asha = await member({ name: "Asha" });
      const ravi = await member({ name: "Ravi" });
      const soon = await propose(asha, ravi, { startsAt: at(1.5) });
      const far = await propose(asha, ravi, { startsAt: at(30) });
      const unanswered = await propose(asha, ravi, { startsAt: at(1.6) });
      for (const id of [soon.id, far.id]) {
        await respondToSession(ravi.actor, id, { action: "ACCEPT" }, { now: NOW });
      }
      const justBefore = new Date(NOW.getTime() + 0.6 * HOUR);

      await ensureSessionReminders(asha.actor, NOW);
      expect((await notificationsOf(asha)).some((n) => n.type === "SESSION_REMINDER")).toBe(false);
      await ensureSessionReminders(asha.actor, justBefore);
      await ensureSessionReminders(ravi.actor, justBefore);
      await ensureSessionReminders(asha.actor, justBefore);

      for (const who of [asha, ravi]) {
        const reminders = (await notificationsOf(who)).filter((n) => n.type === "SESSION_REMINDER");
        expect(reminders).toHaveLength(1);
        expect(reminders[0]?.session?.id).toBe(soon.id);
      }
      expect(
        (await db.creativeSession.findUniqueOrThrow({ where: { id: unanswered.id } })).remindedAt,
      ).toBeNull();
    });
  });

  describe("the daily job", () => {
    it("saves Completed and lapsed states and erases links 24 hours after the end", async () => {
      const asha = await member();
      const ravi = await member();
      const ended = await propose(asha, ravi, { startsAt: at(2) });
      const lapsed = await propose(asha, ravi, { startsAt: at(3) });
      const future = await propose(asha, ravi, { startsAt: at(400) });
      await respondToSession(ravi.actor, ended.id, { action: "ACCEPT" }, { now: NOW });
      await respondToSession(ravi.actor, future.id, { action: "ACCEPT" }, { now: NOW });

      const firstRun = await runSessionMaintenance(new Date(NOW.getTime() + 10 * HOUR));
      expect(firstRun).toEqual({ completed: 1, lapsed: 1, linksErased: 0 });
      expect((await db.creativeSession.findUniqueOrThrow({ where: { id: ended.id } })).state).toBe(
        "COMPLETED",
      );
      expect((await db.creativeSession.findUniqueOrThrow({ where: { id: lapsed.id } })).state).toBe(
        "CANCELLED",
      );

      const secondRun = await runSessionMaintenance(new Date(NOW.getTime() + 30 * HOUR));
      expect(secondRun.linksErased).toBe(1);
      expect(
        (await db.creativeSession.findUniqueOrThrow({ where: { id: ended.id } })).meetingUrl,
      ).toBeNull();
      expect(
        (await db.creativeSession.findUniqueOrThrow({ where: { id: future.id } })).meetingUrl,
      ).toBe(LINK);
      expect(await runSessionMaintenance(new Date(NOW.getTime() + 30 * HOUR))).toEqual({
        completed: 0,
        lapsed: 0,
        linksErased: 0,
      });
    });
  });

  describe("account deletion", () => {
    it("removes the member's sessions with their notifications", async () => {
      const asha = await member();
      const ravi = await member();
      await propose(asha, ravi);
      await db.user.delete({ where: { id: asha.userId } });

      expect(await db.creativeSession.count()).toBe(0);
      expect(await db.notification.count({ where: { type: "SESSION_PROPOSED" } })).toBe(0);
    });
  });
});
