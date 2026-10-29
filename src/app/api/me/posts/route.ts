import { createOwnPostSchema, ownPostListQuerySchema } from "@/lib/schemas/posts";
import { NotFoundError } from "@/server/lib/errors";
import { created, ok, withRouteHandler } from "@/server/lib/route-handler";
import { createOwnPost, listOwnPosts } from "@/server/modules/content";
import { isOwnProject } from "@/server/modules/journal";

/** GET /api/me/posts?status=DRAFT|PUBLISHED&cursor= — own drafts and posts, last changed first. */
export const GET = withRouteHandler(
  { auth: "user", query: ownPostListQuerySchema },
  async ({ actor, query }) => ok(await listOwnPosts(actor, query)),
);

/**
 * POST /api/me/posts — a new draft → 201. 422 DRAFT_LIMIT at 50 drafts. `projectId` (shared from
 * the journal, JRN-05) must be one of the caller's projects, else 404.
 */
export const POST = withRouteHandler(
  { auth: "user", body: createOwnPostSchema },
  async ({ actor, body }) => {
    if (body.projectId && !(await isOwnProject(actor, body.projectId))) {
      throw new NotFoundError("We couldn't find that project.");
    }
    return created(await createOwnPost(actor, body));
  },
);
