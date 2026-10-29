import { usernameParamsSchema } from "@/lib/schemas/me";
import { postPageQuerySchema } from "@/lib/schemas/posts";
import { ok, withRouteHandler } from "@/server/lib/route-handler";
import { listProfilePosts } from "@/server/modules/content";

/** GET /api/profiles/{username}/posts — published posts, newest first; private profile → none. */
export const GET = withRouteHandler(
  { auth: "user", params: usernameParamsSchema, query: postPageQuerySchema },
  async ({ actor, params, query }) => ok(await listProfilePosts(actor, params.username, query)),
);
