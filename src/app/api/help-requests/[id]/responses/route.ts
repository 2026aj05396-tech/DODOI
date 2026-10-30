import { createHelpResponseSchema, helpIdParamsSchema } from "@/lib/schemas/help";
import { created, withRouteHandler } from "@/server/lib/route-handler";
import { createHelpResponse } from "@/server/modules/help";

/**
 * POST /api/help-requests/{id}/responses — `{ body }` → 201 with the request. 403 EMAIL_NOT_VERIFIED
 * · 404 · 422 OWN_REQUEST / REQUEST_CLOSED · 429 at 30 a day.
 */
export const POST = withRouteHandler(
  { auth: "user", params: helpIdParamsSchema, body: createHelpResponseSchema },
  async ({ actor, params, body }) => created(await createHelpResponse(actor, params.id, body)),
);
