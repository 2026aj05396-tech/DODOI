import {
  communityPostsQuerySchema,
  communitySlugParamsSchema,
  createCommunityPostSchema,
} from "@/lib/schemas/communities";
import { created, ok, withRouteHandler } from "@/server/lib/route-handler";
import { createCommunityPost, listCommunityPosts } from "@/server/modules/communities";

/** GET /api/communities/{slug}/posts?cursor= — discussions with their replies, newest activity first. */
export const GET = withRouteHandler(
  { auth: "user", params: communitySlugParamsSchema, query: communityPostsQuerySchema },
  async ({ actor, params, query }) =>
    ok(await listCommunityPosts(actor, params.slug, { cursor: query.cursor })),
);

/**
 * POST /api/communities/{slug}/posts — `{ body, mediaIds?, parentId? }` → 201 with the post.
 * 403 EMAIL_NOT_VERIFIED, NOT_MEMBER · 404 (parent) · 429.
 */
export const POST = withRouteHandler(
  { auth: "user", params: communitySlugParamsSchema, body: createCommunityPostSchema },
  async ({ actor, params, body }) => created(await createCommunityPost(actor, params.slug, body)),
);
