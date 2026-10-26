import { registerMediaSchema } from "@/lib/schemas/media";
import { created, withRouteHandler } from "@/server/lib/route-handler";
import { registerMedia } from "@/server/modules/content";

/**
 * POST /api/media — admin only (others 404). Re-checks the upload against Cloudinary's metadata;
 * a file that breaks MEDIA-01…03 is deleted (400 / 413). 201 `Media`.
 */
export const POST = withRouteHandler(
  { auth: "public", body: registerMediaSchema },
  async ({ actor, body }) => created(await registerMedia(actor, body)),
);
