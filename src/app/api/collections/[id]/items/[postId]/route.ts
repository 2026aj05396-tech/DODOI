import { collectionItemParamsSchema } from "@/lib/schemas/collections";
import { noContent, withRouteHandler } from "@/server/lib/route-handler";
import { removeFromCollection } from "@/server/modules/collections";
import { addToCollection } from "@/server/modules/library";

/** PUT /api/collections/{id}/items/{postId} — add (saves first if needed) → 204. */
export const PUT = withRouteHandler(
  { auth: "user", params: collectionItemParamsSchema },
  async ({ actor, params }) => {
    await addToCollection(actor, params.id, params.postId);
    return noContent();
  },
);

/** DELETE /api/collections/{id}/items/{postId} — this collection only; the save remains → 204. */
export const DELETE = withRouteHandler(
  { auth: "user", params: collectionItemParamsSchema },
  async ({ actor, params }) => {
    await removeFromCollection(actor, params.id, params.postId);
    return noContent();
  },
);
