import "server-only";

import { db } from "@/server/db/client";

/** What progress can point at: the post's status, material ids and step positions. */
export async function findProgressTargets(postId: string) {
  return db.post.findUnique({
    where: { id: postId },
    select: {
      status: true,
      materials: { select: { id: true } },
      steps: { select: { position: true } },
    },
  });
}

export async function findProgress(userId: string, postId: string) {
  return db.postProgress.findUnique({
    where: { userId_postId: { userId, postId } },
    select: { checkedMaterialIds: true, completedStepPositions: true, updatedAt: true },
  });
}

export async function upsertProgress(
  userId: string,
  postId: string,
  data: { checkedMaterialIds: string[]; completedStepPositions: number[] },
) {
  return db.postProgress.upsert({
    where: { userId_postId: { userId, postId } },
    create: { userId, postId, ...data },
    update: data,
    select: { checkedMaterialIds: true, completedStepPositions: true, updatedAt: true },
  });
}
