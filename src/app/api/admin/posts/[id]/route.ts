import { adminIdParamsSchema, updateAdminPostSchema } from "@/lib/schemas/admin";
import { noContent, ok, withRouteHandler } from "@/server/lib/route-handler";
import { deleteAdminPost, getAdminPost, updateAdminPost } from "@/server/modules/content";

/** GET /api/admin/posts/{id} — full post including drafts and attribution. Admin only (404). */
export const GET = withRouteHandler(
  { auth: "public", params: adminIdParamsSchema },
  async ({ actor, params }) => ok(await getAdminPost(actor, params.id)),
);

/** PATCH /api/admin/posts/{id} — a published post must still meet the publish rules. */
export const PATCH = withRouteHandler(
  { auth: "public", params: adminIdParamsSchema, body: updateAdminPostSchema },
  async ({ actor, params, body }) => ok(await updateAdminPost(actor, params.id, body)),
);

/** DELETE /api/admin/posts/{id} — also deletes its media used nowhere else. */
export const DELETE = withRouteHandler(
  { auth: "public", params: adminIdParamsSchema },
  async ({ actor, params }) => {
    await deleteAdminPost(actor, params.id);
    return noContent();
  },
);
