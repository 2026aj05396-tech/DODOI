import {
  collectionIdParamsSchema,
  listPageQuerySchema,
  updateCollectionSchema,
} from "@/lib/schemas/collections";
import { noContent, ok, withRouteHandler } from "@/server/lib/route-handler";
import { deleteCollection } from "@/server/modules/collections";
import { getCollection, updateCollection } from "@/server/modules/library";

/** GET /api/collections/{id} — the collection and a page of its posts; private + not owner → 404. */
export const GET = withRouteHandler(
  { auth: "user", params: collectionIdParamsSchema, query: listPageQuerySchema },
  async ({ actor, params, query }) => ok(await getCollection(actor, params.id, query)),
);

/** PATCH /api/collections/{id} — `{ name?, visibility? }` (owner) → 200 with the collection. */
export const PATCH = withRouteHandler(
  { auth: "user", params: collectionIdParamsSchema, body: updateCollectionSchema },
  async ({ actor, params, body }) => ok(await updateCollection(actor, params.id, body)),
);

/** DELETE /api/collections/{id} — the collection only; its posts stay saved → 204. */
export const DELETE = withRouteHandler(
  { auth: "user", params: collectionIdParamsSchema },
  async ({ actor, params }) => {
    await deleteCollection(actor, params.id);
    return noContent();
  },
);
