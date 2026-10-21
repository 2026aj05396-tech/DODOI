import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/server/db/client";
import {
  consumeRateLimit,
  enforceRateLimit,
  purgeExpiredRateLimitBuckets,
  type RateLimitRule,
} from "@/server/lib/rate-limit";
import { noContent, withRouteHandler } from "@/server/lib/route-handler";

import { resetDatabase } from "../helpers/database";

const rule: RateLimitRule = { name: "test-action", limit: 5, windowSeconds: 60 };

describe("rate limiting with PostgreSQL", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await resetDatabase();
    await db.$disconnect();
  });

  it("lets exactly `limit` of many simultaneous attempts through", async () => {
    const now = new Date("2026-10-21T10:00:00Z");

    const results = await Promise.all(
      Array.from({ length: 12 }, () => consumeRateLimit(rule, "203.0.113.7", { now })),
    );

    expect(results.filter((result) => result.allowed)).toHaveLength(5);
    const bucket = await db.rateLimitBucket.findFirstOrThrow();
    expect(bucket.count).toBe(12);
  });

  it("stores a hashed key, never the raw subject", async () => {
    await consumeRateLimit(rule, "aanya@example.com");

    const bucket = await db.rateLimitBucket.findFirstOrThrow();
    expect(bucket.key).not.toContain("aanya");
    expect(bucket.key.startsWith("test-action:")).toBe(true);
  });

  it("purges buckets from expired windows only", async () => {
    await consumeRateLimit(rule, "old", { now: new Date("2026-10-20T09:00:00Z") });
    await consumeRateLimit(rule, "current", { now: new Date("2026-10-21T10:00:00Z") });

    const removed = await purgeExpiredRateLimitBuckets(3600, {
      now: new Date("2026-10-21T10:00:30Z"),
    });

    expect(removed).toBe(1);
    expect(await db.rateLimitBucket.count()).toBe(1);
  });

  it("returns 429 with Retry-After through the route handler", async () => {
    const strictRule: RateLimitRule = { name: "test-route", limit: 1, windowSeconds: 60 };
    const handler = withRouteHandler({}, async () => {
      await enforceRateLimit(strictRule, "203.0.113.9");
      return noContent();
    });
    const call = () =>
      handler(new NextRequest("http://localhost/api/test", { method: "POST" }), {
        params: Promise.resolve({}),
      });

    const first = await call();
    const second = await call();

    expect(first.status).toBe(204);
    expect(second.status).toBe(429);
    expect(Number(second.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(await second.json()).toMatchObject({ error: { code: "RATE_LIMITED" } });
  });
});
