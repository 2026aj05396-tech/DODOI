import { z } from "zod";

// API contracts for notifications (API_SPECIFICATION §9.1, P2-07; NTF-01…05).

export const notificationPageQuerySchema = z.object({ cursor: z.string().max(500).optional() });
export type NotificationPageQuery = z.output<typeof notificationPageQuerySchema>;

/** PUT /api/me/notification-preferences: the types given are switched; the rest stay as they are. */
export const notificationPreferencesSchema = z
  .object({
    COMMENT: z.boolean(),
    REPLY: z.boolean(),
    FOLLOW: z.boolean(),
    LIKE: z.boolean(),
    HELP_RESPONSE: z.boolean(),
    HELP_HELPFUL: z.boolean(),
    HELP_RESOLVED: z.boolean(),
  })
  .partial();
export type NotificationPreferencesInput = z.output<typeof notificationPreferencesSchema>;
