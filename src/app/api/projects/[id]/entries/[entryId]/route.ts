import { entryParamsSchema, updateEntrySchema } from "@/lib/schemas/journal";
import { noContent, ok, withRouteHandler } from "@/server/lib/route-handler";
import { deleteEntry, updateEntry } from "@/server/modules/journal";

/** PATCH /api/projects/{id}/entries/{entryId} → 200 with the project. */
export const PATCH = withRouteHandler(
  { auth: "user", params: entryParamsSchema, body: updateEntrySchema },
  async ({ actor, params, body }) => ok(await updateEntry(actor, params.id, params.entryId, body)),
);

/** DELETE /api/projects/{id}/entries/{entryId} → 204. */
export const DELETE = withRouteHandler(
  { auth: "user", params: entryParamsSchema },
  async ({ actor, params }) => {
    await deleteEntry(actor, params.id, params.entryId);
    return noContent();
  },
);
