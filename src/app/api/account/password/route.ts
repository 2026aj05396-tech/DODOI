import { cookies } from "next/headers";

import { changePasswordSchema } from "@/lib/schemas/auth";
import { issueSessionCookie } from "@/server/auth";
import { noContent, withRouteHandler } from "@/server/lib/route-handler";
import { changePassword } from "@/server/modules/users";

/**
 * POST /api/account/password — 204 · 400 INVALID_CURRENT_PASSWORD · 400 NO_PASSWORD_SET (API §3).
 * Other devices are signed out; this one gets a fresh session cookie and stays signed in.
 */
export const POST = withRouteHandler(
  { auth: "user", body: changePasswordSchema },
  async ({ actor, body }) => {
    await changePassword(actor, body);
    const cookie = await issueSessionCookie(actor.id);
    if (cookie) (await cookies()).set(cookie.name, cookie.value, cookie.options);
    return noContent();
  },
);
