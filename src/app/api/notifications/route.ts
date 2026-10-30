import { notificationPageQuerySchema } from "@/lib/schemas/notifications";
import { ok, withRouteHandler } from "@/server/lib/route-handler";
import { listNotifications } from "@/server/modules/notifications";
import { ensureSessionReminders } from "@/server/modules/sessions";

/** GET /api/notifications?cursor= — newest first; likes grouped per post per day (NTF-01). */
export const GET = withRouteHandler(
  { auth: "user", query: notificationPageQuerySchema },
  async ({ actor, query }) => {
    // Session reminders are made when notifications are read (SES-04).
    await ensureSessionReminders(actor);
    return ok(await listNotifications(actor, query));
  },
);
