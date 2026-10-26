import { adminPostListQuerySchema, createAdminPostSchema } from "@/lib/schemas/admin";
import { created, ok, withRouteHandler } from "@/server/lib/route-handler";
import { createAdminPost, listAdminPosts } from "@/server/modules/content";

// Admin posts (API_SPECIFICATION §8). Admin only: everyone else, signed in or not, gets 404.

/** GET /api/admin/posts?status=&skillId=&sourceType=&cursor= — newest changes first. */
export const GET = withRouteHandler(
  { auth: "public", query: adminPostListQuerySchema },
  async ({ actor, query }) => ok(await listAdminPosts(actor, query)),
);

/** POST /api/admin/posts — create a draft. */
export const POST = withRouteHandler(
  { auth: "public", body: createAdminPostSchema },
  async ({ actor, body }) => created(await createAdminPost(actor, body)),
);
