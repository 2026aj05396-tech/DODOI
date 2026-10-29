import "server-only";

import { db } from "@/server/db/client";

// Block table reads (MOD-02). Blocking works in both directions: the blocker and the blocked
// person stop seeing each other's profile, posts and comments, so every read asks "who is blocked
// either way?" through here. Blocking and unblocking themselves live in the `blocks` module, which
// also takes follows and notifications between the two away.

/** Everyone the user blocked and everyone who blocked the user. */
export async function getBlockedUserIds(userId: string): Promise<Set<string>> {
  const rows = await db.block.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  });
  return new Set(rows.map((row) => (row.blockerId === userId ? row.blockedId : row.blockerId)));
}

export async function isBlockedEitherWay(userId: string, otherId: string): Promise<boolean> {
  return (
    (await db.block.count({
      where: {
        OR: [
          { blockerId: userId, blockedId: otherId },
          { blockerId: otherId, blockedId: userId },
        ],
      },
    })) > 0
  );
}

/** True when the block is new. */
export async function addBlock(blockerId: string, blockedId: string): Promise<boolean> {
  const { count } = await db.block.createMany({
    data: [{ blockerId, blockedId }],
    skipDuplicates: true,
  });
  return count > 0;
}

export async function removeBlock(blockerId: string, blockedId: string): Promise<void> {
  await db.block.deleteMany({ where: { blockerId, blockedId } });
}

/** The people the user blocked, newest first. */
export async function findBlockedByUser(
  blockerId: string,
  after: { createdAt: Date; userId: string } | null,
  take: number,
): Promise<{ userId: string; createdAt: Date }[]> {
  const rows = await db.block.findMany({
    where: {
      blockerId,
      ...(after
        ? {
            OR: [
              { createdAt: { lt: after.createdAt } },
              { createdAt: after.createdAt, blockedId: { lt: after.userId } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { blockedId: "desc" }],
    take,
    select: { blockedId: true, createdAt: true },
  });
  return rows.map((row) => ({ userId: row.blockedId, createdAt: row.createdAt }));
}
