import { consentsSchema } from "@/lib/schemas/ai";
import { ok, withRouteHandler } from "@/server/lib/route-handler";
import { getConsents, setConsents } from "@/server/modules/ai";

/** GET /api/me/consents — `{ AI_IMAGES, AI_PROFILE_CONTEXT }`, both off until granted. */
export const GET = withRouteHandler({ auth: "user" }, async ({ actor }) =>
  ok(await getConsents(actor)),
);

/** PUT /api/me/consents — grants or withdraws the types given; withdrawing stops use at once. */
export const PUT = withRouteHandler(
  { auth: "user", body: consentsSchema },
  async ({ actor, body }) => ok(await setConsents(actor, body)),
);
