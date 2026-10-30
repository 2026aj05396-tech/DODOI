import { planRequestSchema } from "@/lib/schemas/ai";
import { ok, withRouteHandler } from "@/server/lib/route-handler";
import { createPlan } from "@/server/modules/ai";

/** Like a message, a plan can take 20 s or more on the free tier. */
export const maxDuration = 60;

/**
 * POST /api/ai/plan — `{ text, skillId? }` → 200 `{ title, craft, skillId, materials, steps }`.
 * 403 EMAIL_NOT_VERIFIED · 404 · 422 AI_BLOCKED · 429 AI_QUOTA · 503 AI_UNAVAILABLE (also when the
 * answer is unusable twice).
 */
export const POST = withRouteHandler(
  { auth: "user", body: planRequestSchema },
  async ({ actor, body }) => ok(await createPlan(actor, body)),
);
