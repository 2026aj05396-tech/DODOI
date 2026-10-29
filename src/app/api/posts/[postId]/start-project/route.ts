import { postIdParamsSchema } from "@/lib/schemas/posts";
import { created, withRouteHandler } from "@/server/lib/route-handler";
import { startProjectFromPost } from "@/server/modules/journal";

/** POST /api/posts/{postId}/start-project — "Start as my project" on a tutorial → 201. */
export const POST = withRouteHandler(
  { auth: "user", params: postIdParamsSchema },
  async ({ actor, params }) => created(await startProjectFromPost(actor, params.postId)),
);
