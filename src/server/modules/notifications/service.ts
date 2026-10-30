import "server-only";

import { z } from "zod";

import type {
  NotificationPageQuery,
  NotificationPreferencesInput,
} from "@/lib/schemas/notifications";
import type { Paginated } from "@/lib/types/api";
import type {
  NotificationItem,
  NotificationPreferences,
  NotificationTypeName,
} from "@/lib/types/notifications";
import type { CreatorSummary } from "@/lib/types/posts";
import type { Actor, AuthenticatedActor } from "@/server/lib/actor";
import { UnauthenticatedError } from "@/server/lib/errors";
import { logger } from "@/server/lib/logger";
import { decodeCursor, encodeCursor } from "@/server/lib/pagination";
import { avatarUrl, getPublishedPostTitles } from "@/server/modules/content";
import { getCreatorProfiles, isBlockedEitherWay } from "@/server/modules/users";

import {
  deleteNotificationsBefore,
  deleteNotificationsBetween,
  deleteNotificationsBy,
  findDisabledTypes,
  findNotifications,
  hasUnread,
  insertNotification,
  markAllRead as markAllReadRows,
  setPreference,
  type NotificationRow,
} from "./repository";

// In-app notifications (P2-07; PRODUCT_REQUIREMENTS NTF-01…05, API_SPECIFICATION §9.1). Comments,
// likes and follows call `notify` after they succeed; a notification never blocks the action that
// caused it. Likes are grouped per post per day when the list is read.

const TYPES: NotificationTypeName[] = [
  "COMMENT",
  "REPLY",
  "FOLLOW",
  "LIKE",
  "HELP_RESPONSE",
  "HELP_HELPFUL",
  "HELP_RESOLVED",
];
/** NTF-05: notifications are kept this long. */
export const NOTIFICATION_RETENTION_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Raw rows read per page; likes in them merge into fewer list items. */
const PAGE_ROWS = 50;

const cursorSchema = z.object({ createdAt: z.iso.datetime(), id: z.string().min(1).max(40) });

function requireSignedIn(actor: Actor): AuthenticatedActor {
  if (!actor) throw new UnauthenticatedError();
  return actor;
}

type NotifyInput = {
  type: NotificationTypeName;
  recipientId: string;
  actorId: string;
  postId?: string;
  commentId?: string;
  /** Help requests (P3-03): the request and its title, kept so the list needs no other module. */
  helpRequestId?: string;
  subject?: string;
};

/**
 * Records a notification unless the recipient is the actor or switched that type off (NTF-04).
 * Failures are logged, not thrown: a comment or like must not fail because its notification did.
 */
export async function notify(input: NotifyInput): Promise<void> {
  if (input.recipientId === input.actorId) return;
  try {
    // NTF-05: never for people blocked either way.
    if (await isBlockedEitherWay(input.recipientId, input.actorId)) return;
    if ((await findDisabledTypes(input.recipientId)).includes(input.type)) return;
    await insertNotification(input);
  } catch (error) {
    logger.error("Could not record a notification", { type: input.type, error });
  }
}

/** Takes back the notification of a like or follow that was undone. */
export async function withdrawNotification(input: {
  type: "LIKE" | "FOLLOW";
  recipientId: string;
  actorId: string;
  postId?: string;
}): Promise<void> {
  try {
    await deleteNotificationsBy(input);
  } catch (error) {
    logger.error("Could not withdraw a notification", { type: input.type, error });
  }
}

function dayOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

type Group = { rows: NotificationRow[] };

/** Likes on one post on one day become one group; everything else stands alone. */
function groupRows(rows: NotificationRow[]): Group[] {
  const groups: Group[] = [];
  const likeGroups = new Map<string, Group>();
  for (const row of rows) {
    if (row.type !== "LIKE" || !row.postId) {
      groups.push({ rows: [row] });
      continue;
    }
    const key = `${row.postId}|${dayOf(row.createdAt)}`;
    const existing = likeGroups.get(key);
    if (existing) existing.rows.push(row);
    else {
      const group = { rows: [row] };
      likeGroups.set(key, group);
      groups.push(group);
    }
  }
  return groups;
}

/** GET /api/notifications: newest first, likes grouped per post per day (NTF-01). */
export async function listNotifications(
  actor: Actor,
  query: NotificationPageQuery,
): Promise<Paginated<NotificationItem>> {
  const user = requireSignedIn(actor);
  const after = query.cursor
    ? (() => {
        const decoded = decodeCursor(query.cursor, cursorSchema);
        return { createdAt: new Date(decoded.createdAt), id: decoded.id };
      })()
    : null;
  const fetched = await findNotifications(user.id, after, PAGE_ROWS + 1);
  const rows = fetched.slice(0, PAGE_ROWS);
  const last = rows.at(-1);

  const groups = groupRows(rows);
  const [titles, creators] = await Promise.all([
    getPublishedPostTitles(rows.flatMap((row) => (row.postId ? [row.postId] : []))),
    getCreatorProfiles([...new Set(rows.flatMap((row) => (row.actorId ? [row.actorId] : [])))]),
  ]);

  const items = groups.flatMap(({ rows: group }): NotificationItem[] => {
    const [newest] = group;
    if (!newest) return [];
    const title = newest.postId ? titles.get(newest.postId) : undefined;
    // A post that is no longer published has nothing to open.
    if (newest.postId && title === undefined) return [];

    const actorIds = [...new Set(group.flatMap((row) => (row.actorId ? [row.actorId] : [])))];
    const named: CreatorSummary[] = actorIds.slice(0, 2).flatMap((id) => {
      const creator = creators.get(id);
      return creator
        ? [
            {
              username: creator.username,
              displayName: creator.displayName,
              avatarUrl: creator.avatarPublicId ? avatarUrl(creator.avatarPublicId) : null,
            },
          ]
        : [];
    });
    return [
      {
        id: newest.id,
        type: newest.type,
        actors: named,
        // A person whose account is gone still counts as one.
        actorCount: Math.max(actorIds.length, 1),
        post: newest.postId && title !== undefined ? { id: newest.postId, title } : null,
        helpRequest:
          newest.helpRequestId && newest.subject
            ? { id: newest.helpRequestId, title: newest.subject }
            : null,
        commentId: newest.commentId,
        isUnread: group.some((row) => row.readAt === null),
        createdAt: newest.createdAt.toISOString(),
      },
    ];
  });

  return {
    items,
    nextCursor:
      fetched.length > PAGE_ROWS && last
        ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
        : null,
  };
}

/** GET /api/notifications/unread: whether the bell shows its dot (NTF-02). */
export async function getHasUnread(actor: Actor): Promise<boolean> {
  return hasUnread(requireSignedIn(actor).id);
}

/** POST /api/notifications/read: marks everything read (NTF-02). */
export async function markAllNotificationsRead(actor: Actor): Promise<void> {
  await markAllReadRows(requireSignedIn(actor).id);
}

/** GET /api/me/notification-preferences: every type is on unless switched off (NTF-04). */
export async function getNotificationPreferences(actor: Actor): Promise<NotificationPreferences> {
  const disabled = new Set(await findDisabledTypes(requireSignedIn(actor).id));
  return Object.fromEntries(
    TYPES.map((type) => [type, !disabled.has(type)]),
  ) as NotificationPreferences;
}

/** PUT /api/me/notification-preferences: the types given are switched on or off. */
export async function updateNotificationPreferences(
  actor: Actor,
  input: NotificationPreferencesInput,
): Promise<NotificationPreferences> {
  const user = requireSignedIn(actor);
  for (const type of TYPES) {
    const enabled = input[type];
    if (enabled !== undefined) await setPreference(user.id, type, enabled);
  }
  return getNotificationPreferences(user);
}

/** Notifications between two people go when one blocks the other (MOD-02). */
export async function removeNotificationsBetween(a: string, b: string): Promise<void> {
  await deleteNotificationsBetween(a, b);
}

/** Daily cleanup (NTF-05): notifications older than 90 days. Returns how many were removed. */
export async function purgeOldNotifications(now = new Date()): Promise<number> {
  return deleteNotificationsBefore(new Date(now.getTime() - NOTIFICATION_RETENTION_DAYS * DAY_MS));
}
