import "server-only";

import { createHash } from "node:crypto";

import { db } from "@/server/db/client";
import { RateLimitError } from "@/server/lib/errors";

// Fixed-window rate limiting (SECURITY_AND_PRIVACY §6). Counters live in PostgreSQL (OD-27)
// behind `RateLimitStore`, so the backing store can change without touching callers.

export type RateLimitRule = {
  /** Stable name of the protected action, e.g. "signin-email". Part of the bucket key. */
  name: string;
  /** Maximum attempts allowed per window. */
  limit: number;
  windowSeconds: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  /** Seconds until the current window ends. */
  retryAfterSeconds: number;
};

export interface RateLimitStore {
  /** Atomically adds one attempt to the bucket and returns the new count. */
  increment(bucketKey: string, windowStart: Date): Promise<number>;
  /** Removes buckets whose window started before `cutoff`. Returns how many were removed. */
  deleteWindowsBefore(cutoff: Date): Promise<number>;
}

export const postgresRateLimitStore: RateLimitStore = {
  async increment(bucketKey, windowStart) {
    // One statement, so concurrent requests cannot both read the same count.
    const [row] = await db.$queryRaw<{ count: number }[]>`
      INSERT INTO rate_limit_bucket (key, window_start, count)
      VALUES (${bucketKey}, ${windowStart}, 1)
      ON CONFLICT (key, window_start)
      DO UPDATE SET count = rate_limit_bucket.count + 1
      RETURNING count
    `;
    if (!row) throw new Error("Rate limit increment returned no row");
    return row.count;
  },

  async deleteWindowsBefore(cutoff) {
    const { count } = await db.rateLimitBucket.deleteMany({
      where: { windowStart: { lt: cutoff } },
    });
    return count;
  },
};

type ConsumeOptions = {
  store?: RateLimitStore;
  now?: Date;
};

/** Hashes the subject so emails and IP addresses are never stored in plain text. */
function toBucketKey(ruleName: string, subject: string): string {
  const digest = createHash("sha256").update(subject).digest("hex");
  return `${ruleName}:${digest}`;
}

/** Records one attempt by `subject` (e.g. an IP or normalised email) and reports whether it is allowed. */
export async function consumeRateLimit(
  rule: RateLimitRule,
  subject: string,
  { store = postgresRateLimitStore, now = new Date() }: ConsumeOptions = {},
): Promise<RateLimitResult> {
  const windowMs = rule.windowSeconds * 1000;
  const windowStartMs = Math.floor(now.getTime() / windowMs) * windowMs;

  const count = await store.increment(toBucketKey(rule.name, subject), new Date(windowStartMs));

  return {
    allowed: count <= rule.limit,
    remaining: Math.max(rule.limit - count, 0),
    retryAfterSeconds: Math.max(Math.ceil((windowStartMs + windowMs - now.getTime()) / 1000), 1),
  };
}

/** Like `consumeRateLimit`, but throws `RateLimitError` (→ 429 with Retry-After) when over the limit. */
export async function enforceRateLimit(
  rule: RateLimitRule,
  subject: string,
  options: ConsumeOptions = {},
): Promise<void> {
  const result = await consumeRateLimit(rule, subject, options);
  if (!result.allowed) {
    throw new RateLimitError(result.retryAfterSeconds);
  }
}

/** Daily cleanup (roadmap P1-33): drops buckets older than the longest window in use. */
export async function purgeExpiredRateLimitBuckets(
  maxWindowSeconds: number,
  { store = postgresRateLimitStore, now = new Date() }: ConsumeOptions = {},
): Promise<number> {
  return store.deleteWindowsBefore(new Date(now.getTime() - maxWindowSeconds * 1000));
}
