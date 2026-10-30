import { sessionActionSchema, sessionIdParamsSchema } from "@/lib/schemas/sessions";
import { ok, withRouteHandler } from "@/server/lib/route-handler";
import { getSession, respondToSession } from "@/server/modules/sessions";

/** GET /api/sessions/{id} — one of your sessions; 404 for anyone else. */
export const GET = withRouteHandler(
  { auth: "user", params: sessionIdParamsSchema },
  async ({ actor, params }) => ok(await getSession(actor, params.id)),
);

/**
 * PATCH /api/sessions/{id} — `{ action: "ACCEPT" | "DECLINE" | "CANCEL" }` or `{ action:
 * "RESCHEDULE", startsAt, meetingUrl? }` (a new proposal; the answer is the new session).
 * 403 NOT_INVITEE · 422 NOT_PENDING, NOT_CANCELLABLE, TOO_SOON, TOO_MANY_OPEN.
 */
export const PATCH = withRouteHandler(
  { auth: "user", params: sessionIdParamsSchema, body: sessionActionSchema },
  async ({ actor, params, body }) => ok(await respondToSession(actor, params.id, body)),
);
