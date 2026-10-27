import { usernameParamsSchema } from "@/lib/schemas/me";
import { ok, withRouteHandler } from "@/server/lib/route-handler";
import { getProfile } from "@/server/modules/library";

/**
 * GET /api/profiles/{username} — signed-in users (OD-29). A private profile shows others only
 * name, username and avatar (OD-10); hidden or deactivated profiles are not found.
 */
export const GET = withRouteHandler(
  { auth: "user", params: usernameParamsSchema },
  async ({ actor, params }) => ok(await getProfile(actor, params.username)),
);
