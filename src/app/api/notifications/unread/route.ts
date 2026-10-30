import { ok, withRouteHandler } from "@/server/lib/route-handler";
import { getHasUnread } from "@/server/modules/notifications";
import { ensureSessionReminders } from "@/server/modules/sessions";

/** GET /api/notifications/unread — `{ hasUnread }`, polled every 60 s while the tab is visible. */
export const GET = withRouteHandler({ auth: "user" }, async ({ actor }) => {
  // The bell is where a session reminder first shows (SES-04), so it is made here when due.
  await ensureSessionReminders(actor);
  return ok({ hasUnread: await getHasUnread(actor) });
});
