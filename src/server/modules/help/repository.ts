import "server-only";

import type { HelpStatus, Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db/client";

// help_request, help_request_media and help_response tables (P3-03). Skills, people and media
// belong to other modules: only their ids are stored here.

type Tx = Prisma.TransactionClient;

const requestSelect = {
  id: true,
  authorId: true,
  skillId: true,
  title: true,
  body: true,
  status: true,
  hiddenAt: true,
  createdAt: true,
  updatedAt: true,
  photos: { select: { mediaId: true }, orderBy: { position: "asc" } },
  _count: { select: { responses: { where: { hiddenAt: null } } } },
} satisfies Prisma.HelpRequestSelect;

export type HelpRequestRow = Prisma.HelpRequestGetPayload<{ select: typeof requestSelect }>;

export type HelpPosition = { createdAt: Date; id: string };

export async function insertRequest(data: {
  authorId: string;
  skillId: string;
  title: string;
  body: string;
  mediaIds: string[];
}): Promise<string> {
  const { mediaIds, ...fields } = data;
  const row = await db.helpRequest.create({
    data: {
      ...fields,
      photos: { create: mediaIds.map((mediaId, position) => ({ mediaId, position })) },
    },
    select: { id: true },
  });
  return row.id;
}

export async function findRequest(id: string): Promise<HelpRequestRow | null> {
  return db.helpRequest.findUnique({ where: { id }, select: requestSelect });
}

export async function findRequests(options: {
  where: Prisma.HelpRequestWhereInput;
  after: HelpPosition | null;
  take: number;
}): Promise<HelpRequestRow[]> {
  const { where, after, take } = options;
  return db.helpRequest.findMany({
    where: {
      ...where,
      ...(after
        ? {
            OR: [
              { createdAt: { lt: after.createdAt } },
              { createdAt: after.createdAt, id: { lt: after.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
    select: requestSelect,
  });
}

const responseSelect = {
  id: true,
  requestId: true,
  authorId: true,
  body: true,
  isHelpful: true,
  hiddenAt: true,
  createdAt: true,
} satisfies Prisma.HelpResponseSelect;

export type HelpResponseRow = Prisma.HelpResponseGetPayload<{ select: typeof responseSelect }>;

export async function findResponses(requestId: string): Promise<HelpResponseRow[]> {
  return db.helpResponse.findMany({
    where: { requestId, hiddenAt: null },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: responseSelect,
  });
}

export async function findResponse(id: string) {
  return db.helpResponse.findUnique({
    where: { id },
    select: {
      ...responseSelect,
      request: { select: { id: true, authorId: true, title: true, hiddenAt: true } },
    },
  });
}

/** Distinct people who answered a request, for "resolved" notifications. */
export async function findResponderIds(requestId: string): Promise<string[]> {
  const rows = await db.helpResponse.findMany({
    where: { requestId, hiddenAt: null },
    distinct: ["authorId"],
    select: { authorId: true },
  });
  return rows.map((row) => row.authorId);
}

/** Adds a response and marks the request as just changed (it stays on the list). */
export async function insertResponse(data: {
  requestId: string;
  authorId: string;
  body: string;
}): Promise<string> {
  return db.$transaction(async (tx: Tx) => {
    const row = await tx.helpResponse.create({ data, select: { id: true } });
    await tx.helpRequest.update({ where: { id: data.requestId }, data: { updatedAt: new Date() } });
    return row.id;
  });
}

export async function setHelpful(id: string, isHelpful: boolean): Promise<void> {
  await db.helpResponse.update({ where: { id }, data: { isHelpful } });
}

export async function updateStatus(
  id: string,
  status: HelpStatus,
  resolvedAt: Date | null,
): Promise<void> {
  await db.helpRequest.update({ where: { id }, data: { status, resolvedAt } });
}

/** Deletes the request (its responses and photo links go with it) and returns its photo ids. */
export async function deleteRequestReturningMedia(id: string): Promise<string[]> {
  return db.$transaction(async (tx: Tx) => {
    const photos = await tx.helpRequestMedia.findMany({
      where: { requestId: id },
      select: { mediaId: true },
    });
    await tx.helpRequest.delete({ where: { id } });
    return photos.map((photo) => photo.mediaId);
  });
}

// --- Moderation (reports) ------------------------------------------------------------------------

export async function findRequestsForModeration(ids: string[]) {
  if (ids.length === 0) return [];
  return db.helpRequest.findMany({
    where: { id: { in: ids } },
    select: { id: true, title: true, hiddenAt: true },
  });
}

export async function findResponsesForModeration(ids: string[]) {
  if (ids.length === 0) return [];
  return db.helpResponse.findMany({
    where: { id: { in: ids } },
    select: { id: true, requestId: true, body: true, hiddenAt: true },
  });
}

export async function updateRequestHidden(id: string, hidden: boolean): Promise<void> {
  await db.helpRequest.update({ where: { id }, data: { hiddenAt: hidden ? new Date() : null } });
}

export async function updateResponseHidden(id: string, hidden: boolean): Promise<void> {
  await db.helpResponse.update({ where: { id }, data: { hiddenAt: hidden ? new Date() : null } });
}
