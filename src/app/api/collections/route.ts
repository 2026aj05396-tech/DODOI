import { createCollectionSchema } from "@/lib/schemas/collections";
import { created, ok, withRouteHandler } from "@/server/lib/route-handler";
import { createCollection, listCollections } from "@/server/modules/library";

/** GET /api/collections — own collections, most recently changed first. */
export const GET = withRouteHandler({ auth: "user" }, async ({ actor }) =>
  ok({ items: await listCollections(actor) }),
);

/**
 * POST /api/collections — `{ name, visibility? }` → 201. 409 COLLECTION_NAME_TAKEN ·
 * 422 COLLECTION_LIMIT_REACHED · 403 EMAIL_NOT_VERIFIED for a public one.
 */
export const POST = withRouteHandler(
  { auth: "user", body: createCollectionSchema },
  async ({ actor, body }) => created(await createCollection(actor, body)),
);
