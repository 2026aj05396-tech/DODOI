import { messageSettingsSchema } from "@/lib/schemas/messages";
import { ok, withRouteHandler } from "@/server/lib/route-handler";
import { getMessageSettings, updateMessageSettings } from "@/server/modules/users";

/** GET /api/me/message-settings — `{ messagePolicy: "EVERYONE" | "FOLLOWING" | "NOBODY" }`. */
export const GET = withRouteHandler({ auth: "user" }, async ({ actor }) =>
  ok(await getMessageSettings(actor)),
);

/** PUT /api/me/message-settings — who can message me (MSG-02). */
export const PUT = withRouteHandler(
  { auth: "user", body: messageSettingsSchema },
  async ({ actor, body }) => ok(await updateMessageSettings(actor, body)),
);
