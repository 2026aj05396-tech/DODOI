import { updateRoleSchema, userIdParamsSchema } from "@/lib/schemas/blocks";
import { noContent, withRouteHandler } from "@/server/lib/route-handler";
import { changeModeratorRole } from "@/server/modules/reports";

/** PATCH /api/admin/users/{id}/role — `{ role: "USER" | "MODERATOR" }` → 204. Admin only, audited. */
export const PATCH = withRouteHandler(
  { auth: "user", params: userIdParamsSchema, body: updateRoleSchema },
  async ({ actor, params, body }) => {
    await changeModeratorRole(actor, params.id, body.role);
    return noContent();
  },
);
