import { signMediaSchema } from "@/lib/schemas/media";
import { ok, withRouteHandler } from "@/server/lib/route-handler";
import { signMediaUpload } from "@/server/modules/content";

/**
 * POST /api/media/sign — admin only in Phase 1 (others 404). 413 PAYLOAD_TOO_LARGE ·
 * 400 UNSUPPORTED_MEDIA_TYPE · 429. Returns what the browser needs to upload to Cloudinary.
 */
export const POST = withRouteHandler(
  // "public" so signed-out callers also get the admin-style 404, not a 401 that reveals the route.
  { auth: "public", body: signMediaSchema },
  async ({ actor, body }) => ok(await signMediaUpload(actor, body)),
);
