import { registerSchema } from "@/lib/schemas/auth";
import { getClientIp } from "@/server/lib/client-ip";
import { created, withRouteHandler } from "@/server/lib/route-handler";
import { registerWithPassword } from "@/server/modules/users";

/**
 * POST /api/account/register (API_SPECIFICATION §3). 201 `verification_sent` ·
 * 409 EMAIL_ALREADY_REGISTERED / EMAIL_REGISTERED_WITH_GOOGLE · 422 UNDER_MINIMUM_AGE · 429.
 */
export const POST = withRouteHandler(
  { auth: "public", body: registerSchema },
  async ({ request, body }) =>
    created(await registerWithPassword(body, getClientIp(request.headers))),
);
