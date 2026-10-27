import { deleteAccountSchema } from "@/lib/schemas/auth";
import type { AccountDeletionResponse } from "@/lib/types/auth";
import { withRouteHandler } from "@/server/lib/route-handler";
import { requestAccountDeletion } from "@/server/modules/users";

/**
 * DELETE /api/account — 202 `{ deletionScheduledFor }` · 400 INVALID_PASSWORD · 403
 * REAUTHENTICATION_REQUIRED · 403 ADMIN_ACCOUNT (API §3, P1-28). Deactivates the account and signs
 * out every session, this one included; it is deleted 14 days later unless cancelled.
 */
export const DELETE = withRouteHandler(
  { auth: "user", body: deleteAccountSchema },
  async ({ actor, body }) => {
    const { deletionScheduledFor } = await requestAccountDeletion(actor, body);
    const response: AccountDeletionResponse = {
      deletionScheduledFor: deletionScheduledFor.toISOString(),
    };
    return Response.json(response, { status: 202 });
  },
);
