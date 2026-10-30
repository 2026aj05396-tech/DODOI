import { messagePeopleQuerySchema } from "@/lib/schemas/messages";
import { ok, withRouteHandler } from "@/server/lib/route-handler";
import { listMessagePeople } from "@/server/modules/messages";

/**
 * GET /api/conversations/people?q=&cursor= — the members you can message now (MSG-06). Without `q`
 * your follows and followers; with it a search. 403 EMAIL_NOT_VERIFIED · 429 at 60 a minute.
 */
export const GET = withRouteHandler(
  { auth: "user", query: messagePeopleQuerySchema },
  async ({ actor, query }) => ok(await listMessagePeople(actor, query)),
);
