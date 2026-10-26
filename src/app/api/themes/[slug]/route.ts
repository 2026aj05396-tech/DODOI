import { postPageQuerySchema, themeSlugParamsSchema } from "@/lib/schemas/posts";
import { ok, withRouteHandler } from "@/server/lib/route-handler";
import { getTheme } from "@/server/modules/content";

/** GET /api/themes/{slug} — the theme and a page of its posts (`?cursor`); unpublished → 404. */
export const GET = withRouteHandler(
  { auth: "user", params: themeSlugParamsSchema, query: postPageQuerySchema },
  async ({ actor, params, query }) => ok(await getTheme(actor, params.slug, query)),
);
