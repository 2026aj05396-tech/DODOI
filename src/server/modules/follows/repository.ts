import "server-only";

import { db } from "@/server/db/client";

// follow table. People belong to the users module: only user ids are stored and read here.

/** True when the follow is new (following again changes nothing). */
export async function insertFollow(followerId: string, followeeId: string): Promise<boolean> {
  const { count } = await db.follow.createMany({
    data: [{ followerId, followeeId }],
    skipDuplicates: true,
  });
  return count > 0;
}

export async function deleteFollow(followerId: string, followeeId: string): Promise<void> {
  await db.follow.deleteMany({ where: { followerId, followeeId } });
}

export async function hasFollow(followerId: string, followeeId: string): Promise<boolean> {
  return (await db.follow.count({ where: { followerId, followeeId } })) > 0;
}

export async function findFolloweeIds(followerId: string): Promise<string[]> {
  const rows = await db.follow.findMany({ where: { followerId }, select: { followeeId: true } });
  return rows.map((row) => row.followeeId);
}

/** Which of `userIds` the follower follows. */
export async function findFollowedAmong(followerId: string, userIds: string[]): Promise<string[]> {
  if (userIds.length === 0) return [];
  const rows = await db.follow.findMany({
    where: { followerId, followeeId: { in: userIds } },
    select: { followeeId: true },
  });
  return rows.map((row) => row.followeeId);
}

export async function countFollowers(userId: string): Promise<number> {
  return db.follow.count({ where: { followeeId: userId } });
}

export async function countFollowing(userId: string): Promise<number> {
  return db.follow.count({ where: { followerId: userId } });
}

type Edge = { userId: string; createdAt: Date };

/** The people who follow `userId`, newest first; `after` continues from the last row seen. */
export async function findFollowers(
  userId: string,
  after: { createdAt: Date; userId: string } | null,
  take: number,
): Promise<Edge[]> {
  const rows = await db.follow.findMany({
    where: {
      followeeId: userId,
      ...(after
        ? {
            OR: [
              { createdAt: { lt: after.createdAt } },
              { createdAt: after.createdAt, followerId: { lt: after.userId } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { followerId: "desc" }],
    take,
    select: { followerId: true, createdAt: true },
  });
  return rows.map((row) => ({ userId: row.followerId, createdAt: row.createdAt }));
}

/** The people `userId` follows, newest first. */
export async function findFollowing(
  userId: string,
  after: { createdAt: Date; userId: string } | null,
  take: number,
): Promise<Edge[]> {
  const rows = await db.follow.findMany({
    where: {
      followerId: userId,
      ...(after
        ? {
            OR: [
              { createdAt: { lt: after.createdAt } },
              { createdAt: after.createdAt, followeeId: { lt: after.userId } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { followeeId: "desc" }],
    take,
    select: { followeeId: true, createdAt: true },
  });
  return rows.map((row) => ({ userId: row.followeeId, createdAt: row.createdAt }));
}

/** Takes away follows in both directions between two people (on block, MOD-02). */
export async function deleteFollowsBetween(a: string, b: string): Promise<void> {
  await db.follow.deleteMany({
    where: {
      OR: [
        { followerId: a, followeeId: b },
        { followerId: b, followeeId: a },
      ],
    },
  });
}
