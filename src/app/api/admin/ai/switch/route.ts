import { aiSwitchSchema } from "@/lib/schemas/ai";
import { ok, withRouteHandler } from "@/server/lib/route-handler";
import { setAiSwitch } from "@/server/modules/ai";

/**
 * PUT /api/admin/ai/switch — `{ enabled }` → 200 with the switch state. The companion kill switch,
 * stored in the database on top of `AI_ENABLED`; audited. Admin only, 404 for everyone else.
 */
export const PUT = withRouteHandler(
  { auth: "public", body: aiSwitchSchema },
  async ({ actor, body }) => ok(await setAiSwitch(actor, body.enabled)),
);
