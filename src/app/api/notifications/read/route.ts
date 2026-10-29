import { noContent, withRouteHandler } from "@/server/lib/route-handler";
import { markAllNotificationsRead } from "@/server/modules/notifications";

/** POST /api/notifications/read — marks every notification read → 204 (NTF-02). */
export const POST = withRouteHandler({ auth: "user" }, async ({ actor }) => {
  await markAllNotificationsRead(actor);
  return noContent();
});
