import { createHelpRequestSchema, helpListQuerySchema } from "@/lib/schemas/help";
import { created, ok, withRouteHandler } from "@/server/lib/route-handler";
import { createHelpRequest, listHelpRequests } from "@/server/modules/help";

/** GET /api/help-requests?status=&skillId=&matching=&mine=&cursor= — open requests by default, newest first. */
export const GET = withRouteHandler(
  { auth: "user", query: helpListQuerySchema },
  async ({ actor, query }) => ok(await listHelpRequests(actor, query)),
);

/**
 * POST /api/help-requests — `{ title, body, skillId, mediaIds? }` → 201 with the request.
 * 403 EMAIL_NOT_VERIFIED · 400 (skill or photos) · 429 at 5 a day.
 */
export const POST = withRouteHandler(
  { auth: "user", body: createHelpRequestSchema },
  async ({ actor, body }) => created(await createHelpRequest(actor, body)),
);
