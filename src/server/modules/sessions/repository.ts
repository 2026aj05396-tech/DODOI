import "server-only";

import type { Prisma, SessionState } from "@/generated/prisma/client";
import { db } from "@/server/db/client";

// creative_session table (P3-04). People and help requests belong to other modules: only their ids
// are stored here.

type Tx = Prisma.TransactionClient;

const sessionSelect = {
  id: true,
  proposerId: true,
  inviteeId: true,
  helpRequestId: true,
  startsAt: true,
  endsAt: true,
  durationMin: true,
  note: true,
  meetingUrl: true,
  state: true,
  remindedAt: true,
  createdAt: true,
} satisfies Prisma.CreativeSessionSelect;

export type SessionRow = Prisma.CreativeSessionGetPayload<{ select: typeof sessionSelect }>;

export type SessionPosition = { startsAt: Date; id: string };

export function endOf(startsAt: Date, durationMin: number): Date {
  return new Date(startsAt.getTime() + durationMin * 60 * 1000);
}

export async function findSession(id: string): Promise<SessionRow | null> {
  return db.creativeSession.findUnique({ where: { id }, select: sessionSelect });
}

/** Proposals the member made that still wait for an answer and have not started (SES-02). */
export async function countOpenProposals(proposerId: string, now: Date): Promise<number> {
  return db.creativeSession.count({
    where: { proposerId, state: "PROPOSED", startsAt: { gt: now } },
  });
}

export async function insertSession(
  data: {
    proposerId: string;
    inviteeId: string;
    helpRequestId: string | null;
    startsAt: Date;
    durationMin: number;
    note: string | null;
    meetingUrl: string;
    replacesId?: string;
  },
  tx: Tx | typeof db = db,
): Promise<SessionRow> {
  return tx.creativeSession.create({
    data: { ...data, endsAt: endOf(data.startsAt, data.durationMin) },
    select: sessionSelect,
  });
}

export async function updateSessionState(
  id: string,
  state: SessionState,
  options: { eraseLink?: boolean } = {},
  tx: Tx | typeof db = db,
): Promise<void> {
  await tx.creativeSession.update({
    where: { id },
    data: { state, ...(options.eraseLink ? { meetingUrl: null } : {}) },
  });
}

/** Marks the old time as replaced and creates the new proposal in one step. */
export async function replaceSession(
  oldId: string,
  next: Parameters<typeof insertSession>[0],
): Promise<SessionRow> {
  return db.$transaction(async (tx: Tx) => {
    await updateSessionState(oldId, "RESCHEDULED", { eraseLink: true }, tx);
    return insertSession({ ...next, replacesId: oldId }, tx);
  });
}

const upcomingWhere = (userId: string, now: Date): Prisma.CreativeSessionWhereInput => ({
  OR: [{ proposerId: userId }, { inviteeId: userId }],
  AND: [
    {
      OR: [
        { state: "ACCEPTED", endsAt: { gt: now } },
        { state: "PROPOSED", startsAt: { gt: now } },
      ],
    },
  ],
});

/** Open and accepted sessions that have not ended, soonest first. */
export async function findUpcoming(userId: string, now: Date, take: number): Promise<SessionRow[]> {
  return db.creativeSession.findMany({
    where: upcomingWhere(userId, now),
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    take,
    select: sessionSelect,
  });
}

/** Everything else (declined, replaced, cancelled, completed, unanswered and past), newest first. */
export async function findPast(options: {
  userId: string;
  now: Date;
  after: SessionPosition | null;
  take: number;
}): Promise<SessionRow[]> {
  const { userId, now, after, take } = options;
  return db.creativeSession.findMany({
    where: {
      OR: [{ proposerId: userId }, { inviteeId: userId }],
      NOT: upcomingWhere(userId, now),
      ...(after
        ? {
            AND: [
              {
                OR: [
                  { startsAt: { lt: after.startsAt } },
                  { startsAt: after.startsAt, id: { lt: after.id } },
                ],
              },
            ],
          }
        : {}),
    },
    orderBy: [{ startsAt: "desc" }, { id: "desc" }],
    take,
    select: sessionSelect,
  });
}

/** Accepted sessions of the member that start within the next hour and have no reminder yet. */
export async function findDueForReminder(
  userId: string,
  now: Date,
  until: Date,
): Promise<SessionRow[]> {
  return db.creativeSession.findMany({
    where: {
      OR: [{ proposerId: userId }, { inviteeId: userId }],
      state: "ACCEPTED",
      remindedAt: null,
      startsAt: { gt: now, lte: until },
    },
    select: sessionSelect,
  });
}

/** Claims the reminder for a session; true for exactly one caller, so it is sent once. */
export async function claimReminder(id: string, now: Date): Promise<boolean> {
  const { count } = await db.creativeSession.updateMany({
    where: { id, remindedAt: null },
    data: { remindedAt: now },
  });
  return count > 0;
}

/** A block cancels what is still open between the two (SES-02); links go with it. */
export async function cancelOpenBetween(a: string, b: string, now: Date): Promise<number> {
  const { count } = await db.creativeSession.updateMany({
    where: {
      OR: [
        { proposerId: a, inviteeId: b },
        { proposerId: b, inviteeId: a },
      ],
      AND: [upcomingWhere(a, now)],
    },
    data: { state: "CANCELLED", meetingUrl: null },
  });
  return count;
}

// --- Daily job (SES-02, SES-05) ------------------------------------------------------------------

/** Saves what reads are already showing: ended accepted sessions are Completed, unanswered ones past their start are Cancelled. */
export async function settleSessions(now: Date): Promise<{ completed: number; lapsed: number }> {
  const completed = await db.creativeSession.updateMany({
    where: { state: "ACCEPTED", endsAt: { lte: now } },
    data: { state: "COMPLETED" },
  });
  const lapsed = await db.creativeSession.updateMany({
    where: { state: "PROPOSED", startsAt: { lte: now } },
    data: { state: "CANCELLED", meetingUrl: null },
  });
  return { completed: completed.count, lapsed: lapsed.count };
}

/** Erases meeting links 24 hours after the end (SES-05). */
export async function eraseOldLinks(cutoff: Date): Promise<number> {
  const { count } = await db.creativeSession.updateMany({
    where: { endsAt: { lte: cutoff }, meetingUrl: { not: null } },
    data: { meetingUrl: null },
  });
  return count;
}
