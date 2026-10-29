import { createEntrySchema, projectIdParamsSchema } from "@/lib/schemas/journal";
import { created, withRouteHandler } from "@/server/lib/route-handler";
import { addEntry } from "@/server/modules/journal";

/** POST /api/projects/{id}/entries — `{ title?, body?, mediaIds[] }` → 201 with the project. */
export const POST = withRouteHandler(
  { auth: "user", params: projectIdParamsSchema, body: createEntrySchema },
  async ({ actor, params, body }) => created(await addEntry(actor, params.id, body)),
);
