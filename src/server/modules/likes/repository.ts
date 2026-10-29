import "server-only";

import { db } from "@/server/db/client";

// post_like table. Posts belong to the content module: only the post id is stored and used here.

/** True when the like is new (liking again changes nothing). */
export async function insertLike(postId: string, userId: string): Promise<boolean> {
  const { count } = await db.postLike.createMany({
    data: [{ postId, userId }],
    skipDuplicates: true,
  });
  return count > 0;
}

export async function deleteLike(postId: string, userId: string): Promise<void> {
  await db.postLike.deleteMany({ where: { postId, userId } });
}

export async function hasLike(postId: string, userId: string): Promise<boolean> {
  return (await db.postLike.count({ where: { postId, userId } })) > 0;
}

export async function countLikes(postId: string): Promise<number> {
  return db.postLike.count({ where: { postId } });
}
