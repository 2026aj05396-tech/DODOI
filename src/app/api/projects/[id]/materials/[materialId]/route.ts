import { materialCheckSchema, materialParamsSchema } from "@/lib/schemas/journal";
import { noContent, withRouteHandler } from "@/server/lib/route-handler";
import { checkMaterial } from "@/server/modules/journal";

/** PUT /api/projects/{id}/materials/{materialId} — `{ checked }` → 204. */
export const PUT = withRouteHandler(
  { auth: "user", params: materialParamsSchema, body: materialCheckSchema },
  async ({ actor, params, body }) => {
    await checkMaterial(actor, params.id, params.materialId, body.checked);
    return noContent();
  },
);
