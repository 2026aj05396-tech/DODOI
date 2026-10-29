import { commentIdParamsSchema, updateCommentSchema } from "@/lib/schemas/comments";
import { noContent, ok, withRouteHandler } from "@/server/lib/route-handler";
import { deleteComment, updateComment } from "@/server/modules/comments";

/** PATCH /api/comments/{id} — `{ body }` → the comment, marked edited. */
export const PATCH = withRouteHandler(
  { auth: "user", params: commentIdParamsSchema, body: updateCommentSchema },
  async ({ actor, params, body }) => ok(await updateComment(actor, params.id, body.body)),
);

/** DELETE /api/comments/{id} — the writer or the post's author → 204. */
export const DELETE = withRouteHandler(
  { auth: "user", params: commentIdParamsSchema },
  async ({ actor, params }) => {
    await deleteComment(actor, params.id);
    return noContent();
  },
);
