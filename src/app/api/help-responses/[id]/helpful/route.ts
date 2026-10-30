import { helpIdParamsSchema } from "@/lib/schemas/help";
import { noContent, withRouteHandler } from "@/server/lib/route-handler";
import { setResponseHelpful } from "@/server/modules/help";

/** PUT /api/help-responses/{id}/helpful — the asker marks a response helpful (idempotent) → 204. */
export const PUT = withRouteHandler(
  { auth: "user", params: helpIdParamsSchema },
  async ({ actor, params }) => {
    await setResponseHelpful(actor, params.id, true);
    return noContent();
  },
);

/** DELETE /api/help-responses/{id}/helpful — takes the mark back → 204. */
export const DELETE = withRouteHandler(
  { auth: "user", params: helpIdParamsSchema },
  async ({ actor, params }) => {
    await setResponseHelpful(actor, params.id, false);
    return noContent();
  },
);
