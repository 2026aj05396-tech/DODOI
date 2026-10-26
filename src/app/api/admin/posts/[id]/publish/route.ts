import { adminIdParamsSchema } from "@/lib/schemas/admin";
import { ok, withRouteHandler } from "@/server/lib/route-handler";
import { publishPost } from "@/server/modules/content";

/** POST /api/admin/posts/{id}/publish — 400 POST_NOT_PUBLISHABLE lists what is missing. */
export const POST = withRouteHandler(
  { auth: "public", params: adminIdParamsSchema },
  async ({ actor, params }) => ok(await publishPost(actor, params.id)),
);
