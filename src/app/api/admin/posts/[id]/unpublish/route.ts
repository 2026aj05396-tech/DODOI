import { adminIdParamsSchema } from "@/lib/schemas/admin";
import { ok, withRouteHandler } from "@/server/lib/route-handler";
import { unpublishPost } from "@/server/modules/content";

/** POST /api/admin/posts/{id}/unpublish. */
export const POST = withRouteHandler(
  { auth: "public", params: adminIdParamsSchema },
  async ({ actor, params }) => ok(await unpublishPost(actor, params.id)),
);
