import { timingSafeEqual } from "node:crypto";

import { serverEnv } from "@/server/lib/env";
import { NotFoundError } from "@/server/lib/errors";
import { ok, withRouteHandler } from "@/server/lib/route-handler";
import { runDailyJobs } from "@/server/modules/jobs";

// Daily maintenance on hosted environments (P1-33, P1-35): Vercel Cron calls this once a day
// (vercel.json) with `Authorization: Bearer <CRON_SECRET>`. Locally `pnpm jobs:daily` runs the
// same jobs. Anyone else gets 404, as if the route didn't exist.

/** Vercel's longest run on the Hobby plan; the jobs take seconds. */
export const maxDuration = 60;

function isCronRequest(authorization: string | null): boolean {
  const secret = serverEnv.CRON_SECRET;
  if (!secret || !authorization) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(authorization);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

/** GET /api/cron/daily — 200 `{ outcomes }` · 500 if any job failed · 404 to anyone but the cron. */
export const GET = withRouteHandler({ auth: "public" }, async ({ request }) => {
  if (!isCronRequest(request.headers.get("authorization"))) throw new NotFoundError();
  const outcomes = await runDailyJobs();
  if (outcomes.some((outcome) => !outcome.ok)) {
    return Response.json({ outcomes }, { status: 500 });
  }
  return ok({ outcomes });
});
