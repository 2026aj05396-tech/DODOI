import { usernameParamsSchema } from "@/lib/schemas/me";
import { ok, withRouteHandler } from "@/server/lib/route-handler";
import { listProfileProjects } from "@/server/modules/journal";

/** GET /api/profiles/{username}/projects — public projects (the owner sees all of theirs). */
export const GET = withRouteHandler(
  { auth: "user", params: usernameParamsSchema },
  async ({ actor, params }) => ok({ items: await listProfileProjects(actor, params.username) }),
);
