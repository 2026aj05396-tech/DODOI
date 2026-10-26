import "server-only";

import { db } from "@/server/db/client";

export async function insertSession(userId: string, filter: string, expiresAt: Date) {
  return db.feedSession.create({ data: { userId, filter, expiresAt }, select: { id: true } });
}

export async function findSession(id: string) {
  return db.feedSession.findUnique({
    where: { id },
    select: { id: true, userId: true, filter: true, expiresAt: true },
  });
}

export async function findServedPostIds(sessionId: string): Promise<string[]> {
  const rows = await db.feedImpression.findMany({ where: { sessionId }, select: { postId: true } });
  return rows.map((row) => row.postId);
}

/** Two requests for the same page may race; an impression is only stored once. */
export async function insertImpressions(sessionId: string, postIds: string[]): Promise<void> {
  if (postIds.length === 0) return;
  await db.feedImpression.createMany({
    data: postIds.map((postId) => ({ sessionId, postId })),
    skipDuplicates: true,
  });
}

/** Posts the user marked "Not interested" (hidden for good) and, since `since`, their skills. */
export async function findNotInterested(userId: string, since: Date) {
  const rows = await db.feedFeedback.findMany({
    where: { userId, type: "NOT_INTERESTED" },
    select: {
      postId: true,
      createdAt: true,
      post: { select: { skills: { select: { skillId: true } } } },
    },
  });
  return {
    postIds: rows.map((row) => row.postId),
    recentSkillIds: rows
      .filter((row) => row.createdAt >= since)
      .flatMap((row) => row.post.skills.map((skill) => skill.skillId)),
  };
}

export async function upsertNotInterested(userId: string, postId: string): Promise<void> {
  await db.feedFeedback.upsert({
    where: { userId_postId_type: { userId, postId, type: "NOT_INTERESTED" } },
    create: { userId, postId, type: "NOT_INTERESTED" },
    update: {},
  });
}

export async function deleteNotInterested(userId: string, postId: string): Promise<void> {
  await db.feedFeedback.deleteMany({ where: { userId, postId, type: "NOT_INTERESTED" } });
}
