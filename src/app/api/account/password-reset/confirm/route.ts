import { passwordResetConfirmSchema } from "@/lib/schemas/auth";
import { noContent, withRouteHandler } from "@/server/lib/route-handler";
import { resetPassword } from "@/server/modules/users";

/** POST /api/account/password-reset/confirm — 204 · 400 TOKEN_INVALID_OR_EXPIRED (API §3). */
export const POST = withRouteHandler(
  { auth: "public", body: passwordResetConfirmSchema },
  async ({ body }) => {
    await resetPassword(body);
    return noContent();
  },
);
