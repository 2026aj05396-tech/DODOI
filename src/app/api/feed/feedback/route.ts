import { feedFeedbackSchema } from "@/lib/schemas/feed";
import { noContent, withRouteHandler } from "@/server/lib/route-handler";
import { markNotInterested, undoNotInterested } from "@/server/modules/feed";

/** POST /api/feed/feedback — `{ postId, type: "NOT_INTERESTED" }` → 204 (idempotent). */
export const POST = withRouteHandler(
  { auth: "user", body: feedFeedbackSchema },
  async ({ actor, body }) => {
    await markNotInterested(actor, body);
    return noContent();
  },
);

/** DELETE /api/feed/feedback — undo, same body → 204. */
export const DELETE = withRouteHandler(
  { auth: "user", body: feedFeedbackSchema },
  async ({ actor, body }) => {
    await undoNotInterested(actor, body);
    return noContent();
  },
);
