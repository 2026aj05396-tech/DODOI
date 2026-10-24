import { noContent, withRouteHandler } from "@/server/lib/route-handler";
import { resendVerificationEmail } from "@/server/modules/users";

/** POST /api/account/verify-email/resend — 204, also when already verified; 429 (API §3). */
export const POST = withRouteHandler({ auth: "user" }, async ({ actor }) => {
  await resendVerificationEmail(actor);
  return noContent();
});
