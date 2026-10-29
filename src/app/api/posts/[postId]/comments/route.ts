import { commentPageQuerySchema, createCommentSchema } from "@/lib/schemas/comments";
import { postIdParamsSchema } from "@/lib/schemas/posts";
import { created, ok, withRouteHandler } from "@/server/lib/route-handler";
import { createComment, listComments } from "@/server/modules/comments";

/** GET /api/posts/{postId}/comments?cursor= — comments, oldest first, with their first replies. */
export const GET = withRouteHandler(
  { auth: "user", params: postIdParamsSchema, query: commentPageQuerySchema },
  async ({ actor, params, query }) => ok(await listComments(actor, params.postId, query)),
);

/** POST /api/posts/{postId}/comments — `{ body, parentId? }` → 201. 403 EMAIL_NOT_VERIFIED, 429 at 30 an hour. */
export const POST = withRouteHandler(
  { auth: "user", params: postIdParamsSchema, body: createCommentSchema },
  async ({ actor, params, body }) => created(await createComment(actor, params.postId, body)),
);
