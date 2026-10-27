import { ok, withRouteHandler } from "@/server/lib/route-handler";
import { explore } from "@/server/modules/search";

/** GET /api/explore — popular, new and to-try skills, themes, beginner-friendly posts. */
export const GET = withRouteHandler({ auth: "user" }, async ({ actor }) =>
  ok(await explore(actor)),
);
