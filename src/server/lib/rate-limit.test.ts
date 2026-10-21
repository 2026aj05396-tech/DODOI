import { describe, expect, it } from "vitest";

import { RateLimitError } from "@/server/lib/errors";
import {
  consumeRateLimit,
  enforceRateLimit,
  type RateLimitRule,
  type RateLimitStore,
} from "@/server/lib/rate-limit";

function createMemoryStore(): RateLimitStore & { keys: string[] } {
  const counts = new Map<string, number>();
  const keys: string[] = [];
  return {
    keys,
    async increment(bucketKey, windowStart) {
      keys.push(bucketKey);
      const mapKey = `${bucketKey}|${windowStart.toISOString()}`;
      const next = (counts.get(mapKey) ?? 0) + 1;
      counts.set(mapKey, next);
      return next;
    },
    async deleteWindowsBefore() {
      return 0;
    },
  };
}

const rule: RateLimitRule = { name: "signin-email", limit: 2, windowSeconds: 60 };
const at = (iso: string) => new Date(iso);

describe("consumeRateLimit", () => {
  it("allows attempts up to the limit and reports what remains", async () => {
    const store = createMemoryStore();
    const now = at("2026-10-21T10:00:10Z");

    const first = await consumeRateLimit(rule, "a@b.com", { store, now });
    const second = await consumeRateLimit(rule, "a@b.com", { store, now });
    const third = await consumeRateLimit(rule, "a@b.com", { store, now });

    expect([first.allowed, second.allowed, third.allowed]).toEqual([true, true, false]);
    expect([first.remaining, second.remaining, third.remaining]).toEqual([1, 0, 0]);
  });

  it("reports the seconds left until the window ends", async () => {
    const result = await consumeRateLimit(rule, "a@b.com", {
      store: createMemoryStore(),
      now: at("2026-10-21T10:00:45Z"),
    });

    expect(result.retryAfterSeconds).toBe(15);
  });

  it("starts counting again in the next window", async () => {
    const store = createMemoryStore();
    for (let attempt = 0; attempt < 3; attempt++) {
      await consumeRateLimit(rule, "a@b.com", { store, now: at("2026-10-21T10:00:59Z") });
    }

    const nextWindow = await consumeRateLimit(rule, "a@b.com", {
      store,
      now: at("2026-10-21T10:01:00Z"),
    });

    expect(nextWindow.allowed).toBe(true);
  });

  it("counts each subject and each rule separately", async () => {
    const store = createMemoryStore();
    const now = at("2026-10-21T10:00:00Z");
    await consumeRateLimit(rule, "a@b.com", { store, now });
    await consumeRateLimit(rule, "a@b.com", { store, now });

    const otherSubject = await consumeRateLimit(rule, "c@d.com", { store, now });
    const otherRule = await consumeRateLimit({ ...rule, name: "password-reset" }, "a@b.com", {
      store,
      now,
    });

    expect(otherSubject.allowed).toBe(true);
    expect(otherRule.allowed).toBe(true);
  });

  it("never passes the raw subject to the store", async () => {
    const store = createMemoryStore();

    await consumeRateLimit(rule, "a@b.com", { store, now: at("2026-10-21T10:00:00Z") });

    expect(store.keys[0]).toMatch(/^signin-email:[0-9a-f]{64}$/);
    expect(store.keys[0]).not.toContain("a@b.com");
  });
});

describe("enforceRateLimit", () => {
  it("throws RateLimitError with Retry-After seconds once the limit is exceeded", async () => {
    const store = createMemoryStore();
    const now = at("2026-10-21T10:00:30Z");
    await enforceRateLimit(rule, "a@b.com", { store, now });
    await enforceRateLimit(rule, "a@b.com", { store, now });

    const attempt = enforceRateLimit(rule, "a@b.com", { store, now });

    await expect(attempt).rejects.toBeInstanceOf(RateLimitError);
    await expect(attempt).rejects.toMatchObject({ retryAfterSeconds: 30, status: 429 });
  });
});
