import { notificationPreferencesSchema } from "@/lib/schemas/notifications";
import { ok, withRouteHandler } from "@/server/lib/route-handler";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "@/server/modules/notifications";

/** GET /api/me/notification-preferences — `{ COMMENT, REPLY, FOLLOW, LIKE }`, all on by default. */
export const GET = withRouteHandler({ auth: "user" }, async ({ actor }) =>
  ok(await getNotificationPreferences(actor)),
);

/** PUT /api/me/notification-preferences — switches the types given (NTF-04). */
export const PUT = withRouteHandler(
  { auth: "user", body: notificationPreferencesSchema },
  async ({ actor, body }) => ok(await updateNotificationPreferences(actor, body)),
);
