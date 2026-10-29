import type { Paginated } from "@/lib/types/api";
import type { NotificationItem, NotificationPreferences } from "@/lib/types/notifications";

import { postJson, requestJson } from "./request";

// Notifications (API_SPECIFICATION §9.1, P2-07).

export function listNotifications(cursor: string | null): Promise<Paginated<NotificationItem>> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return requestJson<Paginated<NotificationItem>>("GET", `/api/notifications${query}`);
}

export async function getHasUnread(): Promise<boolean> {
  const { hasUnread } = await requestJson<{ hasUnread: boolean }>(
    "GET",
    "/api/notifications/unread",
  );
  return hasUnread;
}

export function markAllRead(): Promise<void> {
  return postJson("/api/notifications/read");
}

export function getNotificationPreferences(): Promise<NotificationPreferences> {
  return requestJson<NotificationPreferences>("GET", "/api/me/notification-preferences");
}

export function saveNotificationPreferences(
  input: Partial<NotificationPreferences>,
): Promise<NotificationPreferences> {
  return requestJson<NotificationPreferences>("PUT", "/api/me/notification-preferences", input);
}
