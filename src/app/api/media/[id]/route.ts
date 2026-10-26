import { mediaIdParamsSchema, updateMediaSchema } from "@/lib/schemas/media";
import { ok, withRouteHandler } from "@/server/lib/route-handler";
import { updateMedia } from "@/server/modules/content";

/** PATCH /api/media/{id} — alt text; admin only in Phase 1 (others 404). */
export const PATCH = withRouteHandler(
  { auth: "public", params: mediaIdParamsSchema, body: updateMediaSchema },
  async ({ actor, params, body }) => ok(await updateMedia(actor, params.id, body)),
);
