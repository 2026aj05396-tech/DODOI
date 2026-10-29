import { createProjectSchema, projectListQuerySchema } from "@/lib/schemas/journal";
import { created, ok, withRouteHandler } from "@/server/lib/route-handler";
import { createProject, listMyProjects } from "@/server/modules/journal";

/** GET /api/me/projects?status= — own projects, in progress first. */
export const GET = withRouteHandler(
  { auth: "user", query: projectListQuerySchema },
  async ({ actor, query }) => ok({ items: await listMyProjects(actor, query) }),
);

/** POST /api/me/projects — `{ title, skillId?, visibility? }` → 201. 422 PROJECT_LIMIT at 100. */
export const POST = withRouteHandler(
  { auth: "user", body: createProjectSchema },
  async ({ actor, body }) => created(await createProject(actor, body)),
);
