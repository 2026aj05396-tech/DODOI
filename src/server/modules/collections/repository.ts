import "server-only";

import { db } from "@/server/db/client";

export async function findSavedPostIds(userId: string, postIds: string[]): Promise<string[]> {
  const rows = await db.save.findMany({
    where: { userId, postId: { in: postIds } },
    select: { postId: true },
  });
  return rows.map((row) => row.postId);
}

/** Skill ids of the posts the user saved since `since` (one entry per save and skill). */
export async function findSavedSkillIdsSince(userId: string, since: Date): Promise<string[]> {
  const saves = await db.save.findMany({
    where: { userId, createdAt: { gte: since } },
    select: { post: { select: { skills: { select: { skillId: true } } } } },
  });
  return saves.flatMap((save) => save.post.skills.map((skill) => skill.skillId));
}
