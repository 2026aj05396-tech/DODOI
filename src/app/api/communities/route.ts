import { communityListQuerySchema, createCommunitySchema } from "@/lib/schemas/communities";
import { created, ok, withRouteHandler } from "@/server/lib/route-handler";
import { createCommunity, listCommunities } from "@/server/modules/communities";

/** GET /api/communities?q=&skill=&mine=&cursor= — interests first, then newest; `mine` lists your circles. */
export const GET = withRouteHandler(
  { auth: "user", query: communityListQuerySchema },
  async ({ actor, query }) => ok(await listCommunities(actor, query)),
);

/**
 * POST /api/communities — `{ name, skillId, description, rules? }` → 201 with the community.
 * 403 EMAIL_NOT_VERIFIED · 400 (skill, blocked words) · 422 NAME_TAKEN, COMMUNITY_LIMIT · 429 at 2 a day.
 */
export const POST = withRouteHandler(
  { auth: "user", body: createCommunitySchema },
  async ({ actor, body }) => created(await createCommunity(actor, body)),
);
