import { noContent, ok, withRouteHandler } from "@/server/lib/route-handler";
import { getSkillSuggestion } from "@/server/modules/feed";

/** GET /api/feed/suggestion — the "New to you" card for the desktop right rail, or 204. */
export const GET = withRouteHandler({ auth: "user" }, async ({ actor }) => {
  const suggestion = await getSkillSuggestion(actor);
  return suggestion ? ok(suggestion) : noContent();
});
