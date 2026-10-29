// Public API of the notifications module (CODE_QUALITY §3.2): in-app notifications (P2-07).
export {
  getHasUnread,
  getNotificationPreferences,
  listNotifications,
  markAllNotificationsRead,
  notify,
  NOTIFICATION_RETENTION_DAYS,
  purgeOldNotifications,
  updateNotificationPreferences,
  withdrawNotification,
} from "./service";
