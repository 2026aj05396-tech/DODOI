import { ok, withRouteHandler } from "@/server/lib/route-handler";
import { getHasUnread } from "@/server/modules/notifications";

/** GET /api/notifications/unread — `{ hasUnread }`, polled every 60 s while the tab is visible. */
export const GET = withRouteHandler({ auth: "user" }, async ({ actor }) =>
  ok({ hasUnread: await getHasUnread(actor) }),
);
