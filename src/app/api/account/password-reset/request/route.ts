import { after } from "next/server";

import { passwordResetRequestSchema } from "@/lib/schemas/auth";
import { getClientIp } from "@/server/lib/client-ip";
import { noContent, withRouteHandler } from "@/server/lib/route-handler";
import { requestPasswordReset } from "@/server/modules/users";

/**
 * POST /api/account/password-reset/request — always 204 (API_SPECIFICATION §3); 429. The email is
 * sent after the response so its timing cannot reveal whether the account exists.
 */
export const POST = withRouteHandler(
  { auth: "public", body: passwordResetRequestSchema },
  async ({ request, body }) => {
    await requestPasswordReset(body, getClientIp(request.headers), {
      defer: (task) => after(task),
    });
    return noContent();
  },
);
