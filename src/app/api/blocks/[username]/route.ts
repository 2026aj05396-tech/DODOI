import { blockUsernameParamsSchema } from "@/lib/schemas/blocks";
import { noContent, withRouteHandler } from "@/server/lib/route-handler";
import { blockUser, unblockUser } from "@/server/modules/blocks";

/** PUT /api/blocks/{username} — block (idempotent) → 204. 422 SELF_BLOCK. The other person is not told. */
export const PUT = withRouteHandler(
  { auth: "user", params: blockUsernameParamsSchema },
  async ({ actor, params }) => {
    await blockUser(actor, params.username);
    return noContent();
  },
);

/** DELETE /api/blocks/{username} — unblock (idempotent) → 204. */
export const DELETE = withRouteHandler(
  { auth: "user", params: blockUsernameParamsSchema },
  async ({ actor, params }) => {
    await unblockUser(actor, params.username);
    return noContent();
  },
);
