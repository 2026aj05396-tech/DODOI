import { aiFeedbackSchema, aiMessageParamsSchema } from "@/lib/schemas/ai";
import { noContent, withRouteHandler } from "@/server/lib/route-handler";
import { submitFeedback } from "@/server/modules/ai";

/** PUT /api/ai/messages/{id}/feedback — `{ helpful, comment? }` → 204. */
export const PUT = withRouteHandler(
  { auth: "user", params: aiMessageParamsSchema, body: aiFeedbackSchema },
  async ({ actor, params, body }) => {
    await submitFeedback(actor, params.id, body);
    return noContent();
  },
);
