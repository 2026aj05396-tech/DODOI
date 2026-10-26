import { adminIdParamsSchema, updateAdminThemeSchema } from "@/lib/schemas/admin";
import { noContent, ok, withRouteHandler } from "@/server/lib/route-handler";
import { deleteAdminTheme, getAdminTheme, updateAdminTheme } from "@/server/modules/content";

/** GET /api/admin/themes/{id}. Admin only (404). */
export const GET = withRouteHandler(
  { auth: "public", params: adminIdParamsSchema },
  async ({ actor, params }) => ok(await getAdminTheme(actor, params.id)),
);

/** PATCH /api/admin/themes/{id} — `postIds` replaces the theme's posts in order. */
export const PATCH = withRouteHandler(
  { auth: "public", params: adminIdParamsSchema, body: updateAdminThemeSchema },
  async ({ actor, params, body }) => ok(await updateAdminTheme(actor, params.id, body)),
);

/** DELETE /api/admin/themes/{id} — the posts themselves stay. */
export const DELETE = withRouteHandler(
  { auth: "public", params: adminIdParamsSchema },
  async ({ actor, params }) => {
    await deleteAdminTheme(actor, params.id);
    return noContent();
  },
);
