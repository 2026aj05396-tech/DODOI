import { proposeSessionSchema, sessionListQuerySchema } from "@/lib/schemas/sessions";
import { created, ok, withRouteHandler } from "@/server/lib/route-handler";
import { listSessions, proposeSession } from "@/server/modules/sessions";

/** GET /api/sessions?scope=upcoming|past&cursor= — your sessions; the link only once accepted. */
export const GET = withRouteHandler(
  { auth: "user", query: sessionListQuerySchema },
  async ({ actor, query }) => ok(await listSessions(actor, query)),
);

/**
 * POST /api/sessions — propose `{ inviteeUsername, startsAt, durationMin, note?, meetingUrl,
 * helpRequestId? }` → 201. 403 EMAIL_NOT_VERIFIED · 400 (time, length, link) · 404 · 422
 * SELF_SESSION, TOO_MANY_OPEN.
 */
export const POST = withRouteHandler(
  { auth: "user", body: proposeSessionSchema },
  async ({ actor, body }) => created(await proposeSession(actor, body)),
);
