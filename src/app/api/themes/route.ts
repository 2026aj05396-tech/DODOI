import { ok, withRouteHandler } from "@/server/lib/route-handler";
import { listThemes } from "@/server/modules/content";

/** GET /api/themes — published themes in curated order (API_SPECIFICATION §5). */
export const GET = withRouteHandler({ auth: "user" }, async ({ actor }) =>
  ok({ items: await listThemes(actor) }),
);
