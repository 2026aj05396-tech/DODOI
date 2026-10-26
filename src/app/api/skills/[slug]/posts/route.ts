import { postPageQuerySchema } from "@/lib/schemas/posts";
import { skillSlugParamsSchema } from "@/lib/schemas/skills";
import { ok, withRouteHandler } from "@/server/lib/route-handler";
import { listSkillPosts } from "@/server/modules/content";

/** GET /api/skills/{slug}/posts — paginated `PostCard[]`, newest first; hidden skill → 404. */
export const GET = withRouteHandler(
  { auth: "user", params: skillSlugParamsSchema, query: postPageQuerySchema },
  async ({ actor, params, query }) => ok(await listSkillPosts(actor, params.slug, query)),
);
