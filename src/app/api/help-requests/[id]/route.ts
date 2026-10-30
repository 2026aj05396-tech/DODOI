import { helpIdParamsSchema, updateHelpRequestSchema } from "@/lib/schemas/help";
import { noContent, ok, withRouteHandler } from "@/server/lib/route-handler";
import { deleteHelpRequest, getHelpRequest, setHelpRequestStatus } from "@/server/modules/help";

/** GET /api/help-requests/{id} — the request with its responses; 404 when hidden, blocked or unknown. */
export const GET = withRouteHandler(
  { auth: "user", params: helpIdParamsSchema },
  async ({ actor, params }) => ok(await getHelpRequest(actor, params.id)),
);

/** PATCH /api/help-requests/{id} — `{ status }`; only the asker (404 for others); reopening is allowed. */
export const PATCH = withRouteHandler(
  { auth: "user", params: helpIdParamsSchema, body: updateHelpRequestSchema },
  async ({ actor, params, body }) => ok(await setHelpRequestStatus(actor, params.id, body.status)),
);

/** DELETE /api/help-requests/{id} — only the asker; responses and photos go with it → 204. */
export const DELETE = withRouteHandler(
  { auth: "user", params: helpIdParamsSchema },
  async ({ actor, params }) => {
    await deleteHelpRequest(actor, params.id);
    return noContent();
  },
);
