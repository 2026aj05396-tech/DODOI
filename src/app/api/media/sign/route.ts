import { signMediaSchema } from "@/lib/schemas/media";
import { ok, withRouteHandler } from "@/server/lib/route-handler";
import { signMediaUpload } from "@/server/modules/content";

/**
 * POST /api/media/sign — signed-in users for avatar/post/entry, admins for covers (others 404).
 * 413 PAYLOAD_TOO_LARGE ·
 * 400 UNSUPPORTED_MEDIA_TYPE · 429. Returns what the browser needs to upload to Cloudinary.
 */
export const POST = withRouteHandler(
  // "public" so signed-out callers get the same 404 as forbidden purposes, not a 401.
  { auth: "public", body: signMediaSchema },
  async ({ actor, body }) => ok(await signMediaUpload(actor, body)),
);
