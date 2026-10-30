import "server-only";

import { z } from "zod";

import {
  SESSION_MIN_LEAD_MS,
  type ProposeSessionInput,
  type SessionActionInput,
  type SessionListQuery,
} from "@/lib/schemas/sessions";
import type { Paginated } from "@/lib/types/api";
import type { NotificationTypeName } from "@/lib/types/notifications";
import type { CreatorSummary } from "@/lib/types/posts";
import type { SessionStateName, SessionView } from "@/lib/types/sessions";
import type { Actor, AuthenticatedActor } from "@/server/lib/actor";
import {
  ForbiddenError,
  NotFoundError,
  UnauthenticatedError,
  UnprocessableError,
  ValidationError,
} from "@/server/lib/errors";
import { decodeCursor, encodeCursor } from "@/server/lib/pagination";
import { avatarUrl } from "@/server/modules/content";
import { getHelpRequestAuthorId } from "@/server/modules/help";
import { notify } from "@/server/modules/notifications";
import {
  getCreatorProfiles,
  getUserIdByUsername,
  isBlockedEitherWay,
} from "@/server/modules/users";

import {
  cancelOpenBetween,
  claimReminder,
  countOpenProposals,
  eraseOldLinks,
  findDueForReminder,
  findPast,
  findSession,
  findUpcoming,
  insertSession,
  replaceSession,
  settleSessions,
  updateSessionState,
  type SessionPosition,
  type SessionRow,
} from "./repository";

// Creative sessions (P3-04; PRODUCT_REQUIREMENTS SES-01…05, USER_FLOWS F-30): a call between two
// members on an external meeting link. Only the two people can see a session (anyone else gets
// 404) and only they see the link, only once it is accepted and until 24 hours after it ends.
// dodoi never hosts or records the call.

/** SES-02: open proposals a member can have at once. */
export const SESSION_OPEN_LIMIT = 5;
/** SES-04: the reminder goes out when a session is this close. */
export const SESSION_REMINDER_LEAD_MS = 60 * 60 * 1000;
/** SES-05: the link is removed this long after the end. */
export const SESSION_LINK_TTL_MS = 24 * 60 * 60 * 1000;
/** Upcoming sessions returned at once: nobody has more than a handful. */
const UPCOMING_LIMIT = 50;
const PAGE_SIZE = 20;

const pastCursorSchema = z.object({ startsAt: z.iso.datetime(), id: z.string().min(1).max(40) });

function requireSignedIn(actor: Actor): AuthenticatedActor {
  if (!actor) throw new UnauthenticatedError();
  return actor;
}

function requireVerified(actor: Actor, action: string): AuthenticatedActor {
  const user = requireSignedIn(actor);
  if (!user.isEmailVerified) {
    throw new ForbiddenError(`Verify your email to ${action}.`, { code: "EMAIL_NOT_VERIFIED" });
  }
  return user;
}

const sessionNotFound = () => new NotFoundError("We couldn't find that session.");

/** What a read shows: an accepted session that ended is Completed; an unanswered one that started is Cancelled. */
export function effectiveState(row: SessionRow, now: Date): SessionStateName {
  if (row.state === "ACCEPTED" && row.endsAt <= now) return "COMPLETED";
  if (row.state === "PROPOSED" && row.startsAt <= now) return "CANCELLED";
  return row.state;
}

function creatorSummary(
  profile: { username: string; displayName: string; avatarPublicId: string | null } | undefined,
): CreatorSummary | null {
  return profile
    ? {
        username: profile.username,
        displayName: profile.displayName,
        avatarUrl: profile.avatarPublicId ? avatarUrl(profile.avatarPublicId) : null,
      }
    : null;
}

function otherOf(row: SessionRow, userId: string): string {
  return row.proposerId === userId ? row.inviteeId : row.proposerId;
}

async function toViews(user: AuthenticatedActor, rows: SessionRow[], now: Date) {
  const creators = await getCreatorProfiles([...new Set(rows.map((row) => otherOf(row, user.id)))]);
  return rows.map((row): SessionView => {
    const state = effectiveState(row, now);
    const isProposer = row.proposerId === user.id;
    const linkVisible =
      (state === "ACCEPTED" || state === "COMPLETED") &&
      row.meetingUrl !== null &&
      now.getTime() < row.endsAt.getTime() + SESSION_LINK_TTL_MS;
    return {
      id: row.id,
      state,
      isProposer,
      other: creatorSummary(creators.get(otherOf(row, user.id))),
      startsAt: row.startsAt.toISOString(),
      durationMin: row.durationMin,
      note: row.note,
      meetingUrl: linkVisible ? row.meetingUrl : null,
      helpRequestId: row.helpRequestId,
      canRespond: state === "PROPOSED" && !isProposer,
      canCancel: (state === "PROPOSED" || state === "ACCEPTED") && row.endsAt > now,
      createdAt: row.createdAt.toISOString(),
    };
  });
}

/** A session the member takes part in and that no block ended; anything else is 404. */
async function loadForParticipant(
  user: AuthenticatedActor,
  id: string,
): Promise<{ row: SessionRow; otherId: string }> {
  const row = await findSession(id);
  if (!row || (row.proposerId !== user.id && row.inviteeId !== user.id)) throw sessionNotFound();
  const otherId = otherOf(row, user.id);
  if (await isBlockedEitherWay(user.id, otherId)) throw sessionNotFound();
  return { row, otherId };
}

function tooSoon() {
  return new ValidationError(undefined, {
    code: "TOO_SOON",
    fields: { startsAt: "Choose a time at least an hour from now." },
  });
}

async function assertRoomForProposal(user: AuthenticatedActor, now: Date): Promise<void> {
  if ((await countOpenProposals(user.id, now)) >= SESSION_OPEN_LIMIT) {
    throw new UnprocessableError(
      `You can have up to ${SESSION_OPEN_LIMIT} proposals waiting for an answer. Cancel one or wait for a reply.`,
      { code: "TOO_MANY_OPEN" },
    );
  }
}

function sessionNotice(
  type: NotificationTypeName,
  recipientId: string,
  actorId: string,
  sessionId: string,
) {
  return notify({ type, recipientId, actorId, sessionId });
}

/** POST /api/sessions (SES-01, SES-03): propose a time and a meeting link to another member. */
export async function proposeSession(
  actor: Actor,
  input: ProposeSessionInput,
  { now = new Date() }: { now?: Date } = {},
): Promise<SessionView> {
  const user = requireVerified(actor, "propose a session");
  const inviteeId = await getUserIdByUsername(input.inviteeUsername);
  const visible = inviteeId ? (await getCreatorProfiles([inviteeId])).has(inviteeId) : false;
  if (!inviteeId || !visible || (await isBlockedEitherWay(user.id, inviteeId))) {
    throw new NotFoundError("We couldn't find that person.");
  }
  if (inviteeId === user.id) {
    throw new UnprocessableError("You can't propose a session to yourself.", {
      code: "SELF_SESSION",
    });
  }
  const startsAt = new Date(input.startsAt);
  if (startsAt.getTime() < now.getTime() + SESSION_MIN_LEAD_MS) throw tooSoon();
  if (input.helpRequestId) {
    // A reply to a help request: the request must exist and be one of the two people's own.
    const authorId = await getHelpRequestAuthorId(input.helpRequestId);
    if (!authorId || (authorId !== user.id && authorId !== inviteeId)) {
      throw new NotFoundError("We couldn't find that request.");
    }
  }
  await assertRoomForProposal(user, now);

  const row = await insertSession({
    proposerId: user.id,
    inviteeId,
    helpRequestId: input.helpRequestId ?? null,
    startsAt,
    durationMin: input.durationMin,
    note: input.note ?? null,
    meetingUrl: input.meetingUrl,
  });
  await sessionNotice("SESSION_PROPOSED", inviteeId, user.id, row.id);
  const [view] = await toViews(user, [row], now);
  if (!view) throw sessionNotFound();
  return view;
}

/** GET /api/sessions?scope=: upcoming (soonest first) or past (newest first) (F-30 step 4). */
export async function listSessions(
  actor: Actor,
  query: SessionListQuery,
  { now = new Date() }: { now?: Date } = {},
): Promise<Paginated<SessionView>> {
  const user = requireSignedIn(actor);
  await ensureSessionReminders(user, now);
  if (query.scope === "upcoming") {
    const rows = await visibleTo(user, await findUpcoming(user.id, now, UPCOMING_LIMIT));
    return { items: await toViews(user, rows, now), nextCursor: null };
  }
  const cursor = query.cursor ? decodeCursor(query.cursor, pastCursorSchema) : null;
  const after: SessionPosition | null = cursor
    ? { startsAt: new Date(cursor.startsAt), id: cursor.id }
    : null;
  const found = await findPast({ userId: user.id, now, after, take: PAGE_SIZE + 1 });
  const page = found.slice(0, PAGE_SIZE);
  const last = page.at(-1);
  return {
    items: await toViews(user, await visibleTo(user, page), now),
    nextCursor:
      found.length > PAGE_SIZE && last
        ? encodeCursor({ startsAt: last.startsAt.toISOString(), id: last.id })
        : null,
  };
}

/** Sessions with someone either side blocked are not listed. */
async function visibleTo(user: AuthenticatedActor, rows: SessionRow[]): Promise<SessionRow[]> {
  const flags = await Promise.all(
    rows.map((row) => isBlockedEitherWay(user.id, otherOf(row, user.id))),
  );
  return rows.filter((_, index) => !flags[index]);
}

/** GET /api/sessions/{id}. */
export async function getSession(
  actor: Actor,
  id: string,
  { now = new Date() }: { now?: Date } = {},
): Promise<SessionView> {
  const user = requireSignedIn(actor);
  const { row } = await loadForParticipant(user, id);
  const [view] = await toViews(user, [row], now);
  if (!view) throw sessionNotFound();
  return view;
}

/** PATCH /api/sessions/{id} (SES-02): accept, decline, suggest another time, or cancel. */
export async function respondToSession(
  actor: Actor,
  id: string,
  input: SessionActionInput,
  { now = new Date() }: { now?: Date } = {},
): Promise<SessionView> {
  const user = requireVerified(actor, "answer a session");
  const { row, otherId } = await loadForParticipant(user, id);
  const state = effectiveState(row, now);
  const isInvitee = row.inviteeId === user.id;
  const notInvitee = () =>
    new ForbiddenError("Only the person who was invited can answer.", { code: "NOT_INVITEE" });
  const notPending = () =>
    new UnprocessableError("This proposal has already been answered or has passed.", {
      code: "NOT_PENDING",
    });

  let result: SessionRow = row;
  switch (input.action) {
    case "ACCEPT":
    case "DECLINE": {
      if (!isInvitee) throw notInvitee();
      if (state !== "PROPOSED") throw notPending();
      const accepted = input.action === "ACCEPT";
      await updateSessionState(row.id, accepted ? "ACCEPTED" : "DECLINED", {
        eraseLink: !accepted,
      });
      await sessionNotice(
        accepted ? "SESSION_ACCEPTED" : "SESSION_DECLINED",
        otherId,
        user.id,
        row.id,
      );
      result = { ...row, state: accepted ? "ACCEPTED" : "DECLINED" };
      break;
    }
    case "CANCEL": {
      if (state !== "PROPOSED" && state !== "ACCEPTED") {
        throw new UnprocessableError("This session can't be cancelled any more.", {
          code: "NOT_CANCELLABLE",
        });
      }
      if (row.endsAt <= now) {
        throw new UnprocessableError("This session has already ended.", {
          code: "NOT_CANCELLABLE",
        });
      }
      await updateSessionState(row.id, "CANCELLED", { eraseLink: true });
      await sessionNotice("SESSION_CANCELLED", otherId, user.id, row.id);
      result = { ...row, state: "CANCELLED", meetingUrl: null };
      break;
    }
    case "RESCHEDULE": {
      // "Suggest another time": the old proposal is closed and the invitee proposes a new one.
      if (!isInvitee) throw notInvitee();
      if (state !== "PROPOSED") throw notPending();
      const startsAt = new Date(input.startsAt);
      if (startsAt.getTime() < now.getTime() + SESSION_MIN_LEAD_MS) throw tooSoon();
      const meetingUrl = input.meetingUrl ?? row.meetingUrl;
      if (!meetingUrl) {
        throw new ValidationError(undefined, { fields: { meetingUrl: "Add the meeting link." } });
      }
      await assertRoomForProposal(user, now);
      result = await replaceSession(row.id, {
        proposerId: user.id,
        inviteeId: otherId,
        helpRequestId: row.helpRequestId,
        startsAt,
        durationMin: row.durationMin,
        note: row.note,
        meetingUrl,
      });
      await sessionNotice("SESSION_RESCHEDULED", otherId, user.id, result.id);
      break;
    }
  }
  const [view] = await toViews(user, [result], now);
  if (!view) throw sessionNotFound();
  return view;
}

// --- Reminders (SES-04) -------------------------------------------------------------------------------

/**
 * Makes the one-hour reminder for accepted sessions that start within the hour. It runs when a
 * member reads their sessions or notifications (PO 2026-10-30: no hourly job), and each session
 * gets it once, for both people.
 */
export async function ensureSessionReminders(actor: Actor, now: Date = new Date()): Promise<void> {
  const user = requireSignedIn(actor);
  const until = new Date(now.getTime() + SESSION_REMINDER_LEAD_MS);
  for (const row of await findDueForReminder(user.id, now, until)) {
    if (!(await claimReminder(row.id, now))) continue;
    await sessionNotice("SESSION_REMINDER", row.proposerId, row.inviteeId, row.id);
    await sessionNotice("SESSION_REMINDER", row.inviteeId, row.proposerId, row.id);
  }
}

// --- Blocks and the daily job ---------------------------------------------------------------------------

/** A block cancels the sessions still open between the two people (SES-02). */
export async function cancelSessionsBetween(
  a: string,
  b: string,
  now: Date = new Date(),
): Promise<number> {
  return cancelOpenBetween(a, b, now);
}

/**
 * Daily job (SES-02, SES-05): saves Completed and lapsed states, and erases meeting links 24 hours
 * after the end. Reads already show the right state, so this only keeps the table honest.
 */
export async function runSessionMaintenance(
  now: Date = new Date(),
): Promise<{ completed: number; lapsed: number; linksErased: number }> {
  const settled = await settleSessions(now);
  const linksErased = await eraseOldLinks(new Date(now.getTime() - SESSION_LINK_TTL_MS));
  return { ...settled, linksErased };
}
