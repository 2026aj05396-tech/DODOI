import { verifyEmailSchema } from "@/lib/schemas/auth";
import { noContent, withRouteHandler } from "@/server/lib/route-handler";
import { verifyEmail } from "@/server/modules/users";

/** POST /api/account/verify-email — 204 · 400 TOKEN_INVALID_OR_EXPIRED (API_SPECIFICATION §3). */
export const POST = withRouteHandler(
  { auth: "public", body: verifyEmailSchema },
  async ({ body }) => {
    await verifyEmail(body);
    return noContent();
  },
);
