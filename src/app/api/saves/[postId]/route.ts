import { postIdParamsSchema } from "@/lib/schemas/posts";
import { noContent, ok, withRouteHandler } from "@/server/lib/route-handler";
import { unsavePost } from "@/server/modules/collections";
import { savePost } from "@/server/modules/library";

/** PUT /api/saves/{postId} — save (idempotent) → `{ saved: true, saveId }`; 404 unless published. */
export const PUT = withRouteHandler(
  { auth: "user", params: postIdParamsSchema },
  async ({ actor, params }) => ok(await savePost(actor, params.postId)),
);

/** DELETE /api/saves/{postId} — unsave (idempotent); leaves every collection too → 204. */
export const DELETE = withRouteHandler(
  { auth: "user", params: postIdParamsSchema },
  async ({ actor, params }) => {
    await unsavePost(actor, params.postId);
    return noContent();
  },
);
