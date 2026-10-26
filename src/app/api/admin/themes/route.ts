import { createAdminThemeSchema } from "@/lib/schemas/admin";
import { created, ok, withRouteHandler } from "@/server/lib/route-handler";
import { createAdminTheme, listAdminThemes } from "@/server/modules/content";

/** GET /api/admin/themes — all themes, published or not. Admin only (404). */
export const GET = withRouteHandler({ auth: "public" }, async ({ actor }) =>
  ok({ items: await listAdminThemes(actor) }),
);

/** POST /api/admin/themes — 409 SLUG_TAKEN. */
export const POST = withRouteHandler(
  { auth: "public", body: createAdminThemeSchema },
  async ({ actor, body }) => created(await createAdminTheme(actor, body)),
);
