import { projectIdParamsSchema, updateProjectSchema } from "@/lib/schemas/journal";
import { noContent, ok, withRouteHandler } from "@/server/lib/route-handler";
import { deleteProject, getProject, updateProject } from "@/server/modules/journal";

/** GET /api/projects/{id} — the owner's, or a public one; otherwise 404. */
export const GET = withRouteHandler(
  { auth: "user", params: projectIdParamsSchema },
  async ({ actor, params }) => ok(await getProject(actor, params.id)),
);

/** PATCH /api/projects/{id} — title, skill, status, visibility (owner). */
export const PATCH = withRouteHandler(
  { auth: "user", params: projectIdParamsSchema, body: updateProjectSchema },
  async ({ actor, params, body }) => ok(await updateProject(actor, params.id, body)),
);

/** DELETE /api/projects/{id} — with its entries and their photos → 204. */
export const DELETE = withRouteHandler(
  { auth: "user", params: projectIdParamsSchema },
  async ({ actor, params }) => {
    await deleteProject(actor, params.id);
    return noContent();
  },
);
