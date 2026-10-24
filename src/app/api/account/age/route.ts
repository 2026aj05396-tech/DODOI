import { confirmAgeSchema } from "@/lib/schemas/auth";
import { noContent, withRouteHandler } from "@/server/lib/route-handler";
import { confirmAge } from "@/server/modules/users";

/**
 * POST /api/account/age — date-of-birth step for Google sign-ups (API_SPECIFICATION §3).
 * 204 · 422 UNDER_MINIMUM_AGE (the account is deleted; the client signs out).
 */
export const POST = withRouteHandler(
  { auth: "user", allowBeforeAgeCheck: true, body: confirmAgeSchema },
  async ({ actor, body }) => {
    await confirmAge(actor, body);
    return noContent();
  },
);
