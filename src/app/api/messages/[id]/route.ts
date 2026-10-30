import { messageIdParamsSchema } from "@/lib/schemas/messages";
import { noContent, withRouteHandler } from "@/server/lib/route-handler";
import { deleteMessage } from "@/server/modules/messages";

/** DELETE /api/messages/{id} — the sender erases their message (it reads "Message deleted") → 204. */
export const DELETE = withRouteHandler(
  { auth: "user", params: messageIdParamsSchema },
  async ({ actor, params }) => {
    await deleteMessage(actor, params.id);
    return noContent();
  },
);
