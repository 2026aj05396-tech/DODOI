import { notificationPageQuerySchema } from "@/lib/schemas/notifications";
import { ok, withRouteHandler } from "@/server/lib/route-handler";
import { listNotifications } from "@/server/modules/notifications";

/** GET /api/notifications?cursor= — newest first; likes grouped per post per day (NTF-01). */
export const GET = withRouteHandler(
  { auth: "user", query: notificationPageQuerySchema },
  async ({ actor, query }) => ok(await listNotifications(actor, query)),
);
