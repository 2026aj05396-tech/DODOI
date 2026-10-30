import "server-only";

import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants/pagination";
import type {
  CreateHelpRequestInput,
  CreateHelpResponseInput,
  HelpListQuery,
  HelpStatusName,
} from "@/lib/schemas/help";
import type { Paginated } from "@/lib/types/api";
import type { HelpRequestCard, HelpRequestDetail, HelpResponseView } from "@/lib/types/help";
import type { CreatorSummary } from "@/lib/types/posts";
import type { MediaProvider } from "@/server/integrations/media";
import type { Actor, AuthenticatedActor } from "@/server/lib/actor";
import {
  ForbiddenError,
  NotFoundError,
  UnauthenticatedError,
  UnprocessableError,
  ValidationError,
} from "@/server/lib/errors";
import { logger } from "@/server/lib/logger";
import { decodeCursor, encodeCursor } from "@/server/lib/pagination";
import { enforceRateLimit, type RateLimitRule } from "@/server/lib/rate-limit";
import {
  avatarUrl,
  deleteUnusedMedia,
  getMediaMap,
  getOwnedMediaIds,
} from "@/server/modules/content";
import { notify } from "@/server/modules/notifications";
import { getActiveSkillSummaries } from "@/server/modules/skills";
import { getBlockedUserIds, getCreatorProfiles, getProfileSkills } from "@/server/modules/users";

import {
  deleteRequestReturningMedia,
  findRequest,
  findRequests,
  findRequestsForModeration,
  findResponderIds,
  findResponse,
  findResponses,
  findResponsesForModeration,
  insertRequest,
  insertResponse,
  setHelpful,
  updateRequestHidden,
  updateResponseHidden,
  updateStatus,
  type HelpPosition,
  type HelpRequestRow,
} from "./repository";

// Help requests (P3-03; PRODUCT_REQUIREMENTS HLP-01…06, USER_FLOWS F-27). Reading needs a
// signed-in member; asking and answering need a verified email (OD-08). Blocks work both ways, a
// hidden request answers 404 to everyone but its author, and only the asker changes its status.

/** HLP-01: 5 requests a day per member. */
export const HELP_REQUEST_RATE_LIMIT: RateLimitRule = {
  name: "help-request-create",
  limit: 5,
  windowSeconds: 24 * 60 * 60,
};
/** HLP-02: 30 responses a day per member. */
export const HELP_RESPONSE_RATE_LIMIT: RateLimitRule = {
  name: "help-response-create",
  limit: 30,
  windowSeconds: 24 * 60 * 60,
};

/** HLP-04: resolved or idle requests leave the list after this many days (still readable by link). */
export const HELP_LIST_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

const cursorSchema = z.object({ createdAt: z.iso.datetime(), id: z.string().min(1).max(40) });

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

const requestNotFound = () => new NotFoundError("We couldn't find that request.");

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

async function toCards(
  actor: AuthenticatedActor,
  rows: HelpRequestRow[],
): Promise<HelpRequestCard[]> {
  const [skills, creators] = await Promise.all([
    getActiveSkillSummaries([...new Set(rows.map((row) => row.skillId))]),
    getCreatorProfiles([...new Set(rows.map((row) => row.authorId))]),
  ]);
  return rows.map((row) => {
    const skill = skills.get(row.skillId);
    return {
      id: row.id,
      title: row.title,
      status: row.status,
      skill: skill
        ? { id: skill.id, name: skill.name, slug: skill.slug, accent: skill.accent }
        : null,
      author: creatorSummary(creators.get(row.authorId)),
      responseCount: row._count.responses,
      isOwn: row.authorId === actor.id,
      createdAt: row.createdAt.toISOString(),
    };
  });
}

/** POST /api/help-requests (HLP-01). */
export async function createHelpRequest(
  actor: Actor,
  input: CreateHelpRequestInput,
): Promise<HelpRequestDetail> {
  const user = requireVerified(actor, "ask for help");
  if (!(await getActiveSkillSummaries([input.skillId])).has(input.skillId)) {
    throw new ValidationError(undefined, { fields: { skillId: "That craft isn't available." } });
  }
  if (input.mediaIds.length > 0) {
    const owned = await getOwnedMediaIds(user.id, input.mediaIds);
    if (input.mediaIds.some((id) => !owned.has(id))) {
      throw new ValidationError(undefined, {
        fields: { mediaIds: "Some photos aren't available. Upload them again." },
      });
    }
  }
  await enforceRateLimit(HELP_REQUEST_RATE_LIMIT, user.id);
  const id = await insertRequest({ authorId: user.id, ...input });
  return getHelpRequest(user, id);
}

function positionOf(cursor: string | undefined): HelpPosition | null {
  if (!cursor) return null;
  const decoded = decodeCursor(cursor, cursorSchema);
  return { createdAt: new Date(decoded.createdAt), id: decoded.id };
}

function listWhere(
  user: AuthenticatedActor,
  query: HelpListQuery,
  blocked: Set<string>,
  canHelpSkillIds: string[] | null,
  now: Date,
): Prisma.HelpRequestWhereInput {
  const where: Prisma.HelpRequestWhereInput = {
    hiddenAt: null,
    updatedAt: { gte: new Date(now.getTime() - HELP_LIST_DAYS * DAY_MS) },
  };
  if (query.mine) {
    where.authorId = user.id;
  } else {
    where.authorId = { notIn: [...blocked] };
  }
  where.status = query.status ?? "OPEN";
  if (query.skillId) where.skillId = query.skillId;
  if (query.matching) {
    // Other people's requests in the skills the member can help with (HLP-03).
    where.skillId = { in: canHelpSkillIds ?? [] };
    where.authorId = { notIn: [...blocked, user.id] };
  }
  return where;
}

/** GET /api/help-requests: newest first (HLP-01, HLP-03, HLP-04). */
export async function listHelpRequests(
  actor: Actor,
  query: HelpListQuery,
  { now = new Date() }: { now?: Date } = {},
): Promise<Paginated<HelpRequestCard>> {
  const user = requireSignedIn(actor);
  const [blocked, profileSkills] = await Promise.all([
    getBlockedUserIds(user.id),
    query.matching ? getProfileSkills(user.id) : null,
  ]);
  const canHelp = profileSkills?.canHelp.map(({ skill }) => skill.id) ?? null;
  const rows = await findRequests({
    where: listWhere(user, query, blocked, canHelp, now),
    after: positionOf(query.cursor),
    take: DEFAULT_PAGE_SIZE + 1,
  });
  const page = rows.slice(0, DEFAULT_PAGE_SIZE);
  const last = page.at(-1);
  return {
    items: await toCards(user, page),
    nextCursor:
      rows.length > DEFAULT_PAGE_SIZE && last
        ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
        : null,
  };
}

/**
 * The newest open requests in the skills the member can help with, for the right rail and the feed
 * card (HLP-03). Empty when they listed no such skills.
 */
export async function getMatchingHelpRequests(
  actor: Actor,
  limit: number,
): Promise<HelpRequestCard[]> {
  const user = requireSignedIn(actor);
  const [blocked, profileSkills] = await Promise.all([
    getBlockedUserIds(user.id),
    getProfileSkills(user.id),
  ]);
  const canHelp = profileSkills.canHelp.map(({ skill }) => skill.id);
  if (canHelp.length === 0) return [];
  const rows = await findRequests({
    where: listWhere(user, { matching: true }, blocked, canHelp, new Date()),
    after: null,
    take: limit,
  });
  return toCards(user, rows);
}

/**
 * The banner on the Help requests tab (design `1h`): the skills the member can help with and how
 * many open requests in them they could answer (counted up to 21, shown as "20+").
 */
export async function getHelpBanner(
  actor: Actor,
): Promise<{ canHelpSkills: string[]; matchingCount: number }> {
  const user = requireSignedIn(actor);
  const { canHelp } = await getProfileSkills(user.id);
  if (canHelp.length === 0) return { canHelpSkills: [], matchingCount: 0 };
  const matching = await getMatchingHelpRequests(user, 21);
  return {
    canHelpSkills: canHelp.map(({ skill }) => skill.name),
    matchingCount: matching.length,
  };
}

/** GET /api/help-requests/{id}: the request with its responses (HLP-02). */
export async function getHelpRequest(actor: Actor, id: string): Promise<HelpRequestDetail> {
  const user = requireSignedIn(actor);
  const row = await findRequest(id);
  if (!row) throw requestNotFound();
  const isOwn = row.authorId === user.id;
  // A hidden request is gone for everyone else; so is one by someone blocked either way.
  if (row.hiddenAt && !isOwn) throw requestNotFound();
  const blocked = await getBlockedUserIds(user.id);
  if (!isOwn && blocked.has(row.authorId)) throw requestNotFound();

  const responseRows = (await findResponses(id)).filter(
    (response) => !blocked.has(response.authorId),
  );
  const [[card], media, creators] = await Promise.all([
    toCards(user, [row]),
    getMediaMap(row.photos.map((photo) => photo.mediaId)),
    getCreatorProfiles([...new Set(responseRows.map((response) => response.authorId))]),
  ]);
  if (!card) throw requestNotFound();
  const responses: HelpResponseView[] = responseRows.map((response) => ({
    id: response.id,
    body: response.body,
    author: creatorSummary(creators.get(response.authorId)),
    isOwn: response.authorId === user.id,
    isHelpful: response.isHelpful,
    createdAt: response.createdAt.toISOString(),
  }));
  return {
    ...card,
    body: row.body,
    photos: row.photos.flatMap((photo) => {
      const item = media.get(photo.mediaId);
      return item ? [item] : [];
    }),
    responses,
    canRespond: user.isEmailVerified && !isOwn && row.status !== "RESOLVED" && !row.hiddenAt,
    isHidden: row.hiddenAt !== null,
  };
}

/** PATCH /api/help-requests/{id}: only the asker; resolving tells the people who answered (HLP-02). */
export async function setHelpRequestStatus(
  actor: Actor,
  id: string,
  status: HelpStatusName,
): Promise<HelpRequestDetail> {
  const user = requireSignedIn(actor);
  const row = await findRequest(id);
  if (!row || row.authorId !== user.id || row.hiddenAt) throw requestNotFound();
  if (row.status !== status) {
    await updateStatus(id, status, status === "RESOLVED" ? new Date() : null);
    if (status === "RESOLVED") {
      for (const responderId of await findResponderIds(id)) {
        await notify({
          type: "HELP_RESOLVED",
          recipientId: responderId,
          actorId: user.id,
          helpRequestId: id,
          subject: row.title,
        });
      }
    }
  }
  return getHelpRequest(user, id);
}

/** DELETE /api/help-requests/{id}: only the asker; responses and photos go with it (HLP-04). */
export async function deleteHelpRequest(
  actor: Actor,
  id: string,
  options: { provider?: MediaProvider } = {},
): Promise<void> {
  const user = requireSignedIn(actor);
  const row = await findRequest(id);
  if (!row || row.authorId !== user.id) throw requestNotFound();
  const mediaIds = await deleteRequestReturningMedia(id);
  await deleteUnusedMedia(mediaIds, options);
}

/** POST /api/help-requests/{id}/responses (HLP-02). */
export async function createHelpResponse(
  actor: Actor,
  requestId: string,
  input: CreateHelpResponseInput,
): Promise<HelpRequestDetail> {
  const user = requireVerified(actor, "offer help");
  const row = await findRequest(requestId);
  const blocked = await getBlockedUserIds(user.id);
  if (!row || row.hiddenAt || blocked.has(row.authorId)) throw requestNotFound();
  if (row.authorId === user.id) {
    throw new UnprocessableError("You can't answer your own request.", { code: "OWN_REQUEST" });
  }
  if (row.status === "RESOLVED") {
    throw new UnprocessableError("This request is resolved.", { code: "REQUEST_CLOSED" });
  }
  await enforceRateLimit(HELP_RESPONSE_RATE_LIMIT, user.id);
  await insertResponse({ requestId, authorId: user.id, body: input.body });
  await notify({
    type: "HELP_RESPONSE",
    recipientId: row.authorId,
    actorId: user.id,
    helpRequestId: requestId,
    subject: row.title,
  });
  return getHelpRequest(user, requestId);
}

/** PUT / DELETE /api/help-responses/{id}/helpful: only the asker, never on their own response (HLP-02). */
export async function setResponseHelpful(
  actor: Actor,
  responseId: string,
  isHelpful: boolean,
): Promise<void> {
  const user = requireSignedIn(actor);
  const response = await findResponse(responseId);
  if (
    !response ||
    response.hiddenAt ||
    response.request.hiddenAt ||
    response.request.authorId !== user.id ||
    response.authorId === user.id
  ) {
    throw new NotFoundError("We couldn't find that response.");
  }
  if (response.isHelpful === isHelpful) return;
  await setHelpful(responseId, isHelpful);
  if (isHelpful) {
    await notify({
      type: "HELP_HELPFUL",
      recipientId: response.authorId,
      actorId: user.id,
      helpRequestId: response.request.id,
      subject: response.request.title,
    });
  }
}

// --- For reports (HLP-04, MOD) ----------------------------------------------------------------------

/**
 * Whether `actor` may report this request or response: it must be visible to them (published,
 * not hidden, not by someone blocked) and not their own. Returns what the report stores.
 */
export async function getReportableHelpTarget(
  actor: Actor,
  type: "REQUEST" | "RESPONSE",
  id: string,
): Promise<{ id: string; authorId: string } | null> {
  const user = requireSignedIn(actor);
  const blocked = await getBlockedUserIds(user.id);
  if (type === "REQUEST") {
    const row = await findRequest(id);
    if (!row || row.hiddenAt || blocked.has(row.authorId)) return null;
    return { id: row.id, authorId: row.authorId };
  }
  const response = await findResponse(id);
  if (!response || response.hiddenAt || response.request.hiddenAt) return null;
  if (blocked.has(response.authorId) || blocked.has(response.request.authorId)) return null;
  return { id: response.id, authorId: response.authorId };
}

export async function getHelpRequestsForModeration(ids: string[]) {
  return new Map(
    (await findRequestsForModeration(ids)).map((row) => [
      row.id,
      { title: row.title, isHidden: row.hiddenAt !== null },
    ]),
  );
}

export async function getHelpResponsesForModeration(ids: string[]) {
  return new Map(
    (await findResponsesForModeration(ids)).map((row) => [
      row.id,
      { requestId: row.requestId, body: row.body, isHidden: row.hiddenAt !== null },
    ]),
  );
}

export async function setHelpRequestHidden(id: string, hidden: boolean): Promise<void> {
  try {
    await updateRequestHidden(id, hidden);
  } catch (error) {
    logger.error("Could not change a help request's visibility", { error });
    throw error;
  }
}

export async function setHelpResponseHidden(id: string, hidden: boolean): Promise<void> {
  await updateResponseHidden(id, hidden);
}

/** Who asked a request, for sessions proposed from a reply (SES-01); null when it is gone or hidden. */
export async function getHelpRequestAuthorId(id: string): Promise<string | null> {
  const row = await findRequest(id);
  return row && !row.hiddenAt ? row.authorId : null;
}
