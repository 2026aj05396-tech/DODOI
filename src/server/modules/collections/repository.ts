import "server-only";

import { db } from "@/server/db/client";

export async function findSavedPostIds(userId: string, postIds: string[]): Promise<string[]> {
  const rows = await db.save.findMany({
    where: { userId, postId: { in: postIds } },
    select: { postId: true },
  });
  return rows.map((row) => row.postId);
}
