import { noContent, withRouteHandler } from "@/server/lib/route-handler";
import { cancelAccountDeletion } from "@/server/modules/users";

/** POST /api/account/deletion/cancel — 204 (API §3, P1-28). Reactivates a deactivated account. */
export const POST = withRouteHandler(
  { auth: "user", allowWhileDeletionScheduled: true },
  async ({ actor }) => {
    await cancelAccountDeletion(actor);
    return noContent();
  },
);
