import { updateProfileSchema } from "@/lib/schemas/me";
import { ok, withRouteHandler } from "@/server/lib/route-handler";
import { getMyProfile, updateMyProfile } from "@/server/modules/library";

// API_SPECIFICATION §4: the signed-in user's own profile (PRF-01/04/06).

/** GET /api/me/profile — own profile incl. visibility and when the username may next change. */
export const GET = withRouteHandler({ auth: "user" }, async ({ actor }) =>
  ok(await getMyProfile(actor)),
);

/**
 * PATCH /api/me/profile — `{ username?, displayName?, bio?, avatarMediaId?, visibility? }`.
 * 409 USERNAME_TAKEN · 422 USERNAME_CHANGE_TOO_SOON · 400 reserved/offensive or not your avatar.
 */
export const PATCH = withRouteHandler(
  { auth: "user", body: updateProfileSchema },
  async ({ actor, body }) => ok(await updateMyProfile(actor, body)),
);
