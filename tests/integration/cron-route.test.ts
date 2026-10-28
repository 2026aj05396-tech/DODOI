import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getActor } from "@/server/auth";
import { runDailyJobs } from "@/server/modules/jobs";

import * as cronRoute from "../../src/app/api/cron/daily/route";

// GET /api/cron/daily (P1-35): only Vercel Cron, with the secret, runs the daily jobs; anyone else
// gets 404. The jobs themselves are tested in daily-jobs.test.ts.

const { SECRET } = vi.hoisted(() => ({ SECRET: "cron-secret-for-tests-at-least-32-characters" }));

vi.mock("@/server/auth", () => ({ getActor: vi.fn() }));
vi.mock("@/server/modules/jobs", () => ({ runDailyJobs: vi.fn() }));
vi.mock("@/server/lib/env", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/lib/env")>();
  return { serverEnv: { ...original.serverEnv, CRON_SECRET: SECRET } };
});

const mockedRunDailyJobs = vi.mocked(runDailyJobs);
const noParams = { params: Promise.resolve({}) };

function call(authorization?: string) {
  return cronRoute.GET(
    new NextRequest("http://localhost:3000/api/cron/daily", {
      headers: authorization ? { authorization } : {},
    }),
    noParams,
  );
}

describe("daily cron route", () => {
  beforeEach(() => {
    vi.mocked(getActor).mockResolvedValue(null);
    mockedRunDailyJobs.mockReset();
    mockedRunDailyJobs.mockResolvedValue([{ job: "purge-auth-tokens", ok: true, count: 2 }]);
  });

  it("is not found without the secret or with a wrong one, and runs nothing", async () => {
    expect((await call()).status).toBe(404);
    expect((await call("Bearer wrong")).status).toBe(404);
    expect((await call(`Bearer ${SECRET}x`)).status).toBe(404);
    expect(mockedRunDailyJobs).not.toHaveBeenCalled();
  });

  it("runs the jobs for Vercel Cron and reports each one", async () => {
    const response = await call(`Bearer ${SECRET}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      outcomes: [{ job: "purge-auth-tokens", ok: true, count: 2 }],
    });
  });

  it("answers 500 when a job failed, so the failure shows in Vercel's logs", async () => {
    mockedRunDailyJobs.mockResolvedValue([
      { job: "delete-orphaned-media", ok: false, error: "Cloudinary unavailable" },
    ]);

    expect((await call(`Bearer ${SECRET}`)).status).toBe(500);
  });
});
