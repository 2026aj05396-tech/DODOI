import "server-only";

import type { NotificationType } from "@/generated/prisma/client";
import { db } from "@/server/db/client";

// notification and notification_preference tables. Posts, comments and people belong to other
// modules: only their ids are stored here.

export type NotificationRow = {
  id: string;
  type: NotificationType;
  actorId: string | null;
  postId: string | null;
  commentId: string | null;
  readAt: Date | null;
  createdAt: Date;
};

export async function insertNotification(data: {
  type: NotificationType;
  recipientId: string;
  actorId: string | null;
  postId?: string;
  commentId?: string;
}): Promise<void> {
  await db.notification.create({ data });
}

/** A like or follow taken back removes its notification, so liking again does not repeat it. */
export async function deleteNotificationsBy(where: {
  type: NotificationType;
  recipientId: string;
  actorId: string;
  postId?: string;
}): Promise<void> {
  await db.notification.deleteMany({ where });
}

export async function findNotifications(
  recipientId: string,
  after: { createdAt: Date; id: string } | null,
  take: number,
): Promise<NotificationRow[]> {
  return db.notification.findMany({
    where: {
      recipientId,
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
    select: {
      id: true,
      type: true,
      actorId: true,
      postId: true,
      commentId: true,
      readAt: true,
      createdAt: true,
    },
  });
}

export async function hasUnread(recipientId: string): Promise<boolean> {
  return (await db.notification.count({ where: { recipientId, readAt: null }, take: 1 })) > 0;
}

export async function markAllRead(recipientId: string): Promise<void> {
  await db.notification.updateMany({
    where: { recipientId, readAt: null },
    data: { readAt: new Date() },
  });
}

/** The types the user switched off (NTF-04). */
export async function findDisabledTypes(userId: string): Promise<NotificationType[]> {
  const rows = await db.notificationPreference.findMany({
    where: { userId, enabled: false },
    select: { type: true },
  });
  return rows.map((row) => row.type);
}

export async function setPreference(
  userId: string,
  type: NotificationType,
  enabled: boolean,
): Promise<void> {
  // A row exists only while a type is off; switching it back on removes the row.
  if (enabled) await db.notificationPreference.deleteMany({ where: { userId, type } });
  else {
    await db.notificationPreference.upsert({
      where: { userId_type: { userId, type } },
      create: { userId, type, enabled: false },
      update: { enabled: false },
    });
  }
}

export async function deleteNotificationsBefore(cutoff: Date): Promise<number> {
  const { count } = await db.notification.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return count;
}
