import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/server/db/client";
import { runDailyJobs } from "@/server/modules/jobs";

import { resetDatabase } from "../helpers/database";
import { createMedia, createPost, createUser } from "../helpers/factories";
import { createFakeMediaProvider } from "../helpers/fake-media";

// Daily jobs (P1-33, SYSTEM_ARCHITECTURE §12b, DATABASE_SCHEMA §7): each job removes only what is
// expired and a second run removes nothing.

const NOW = new Date("2026-10-27T03:00:00Z");
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const ago = (ms: number) => new Date(NOW.getTime() - ms);

function counts(outcomes: Awaited<ReturnType<typeof runDailyJobs>>) {
  return Object.fromEntries(
    outcomes.map((outcome) => [outcome.job, outcome.ok ? outcome.count : outcome.error]),
  );
}

describe("daily jobs", () => {
  beforeEach(async () => {
    await resetDatabase();
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await resetDatabase();
    await db.$disconnect();
  });

  it("purges only expired data, and a second run purges nothing", async () => {
    const provider = createFakeMediaProvider();
    const user = await createUser();
    const token = (tokenHash: string, expiresAt: Date, usedAt: Date | null = null) =>
      db.authToken.create({
        data: { userId: user.id, type: "EMAIL_VERIFICATION", tokenHash, expiresAt, usedAt },
      });
    await token("expired", ago(HOUR_MS));
    await token("used", new Date(NOW.getTime() + HOUR_MS), ago(HOUR_MS));
    await token("valid", new Date(NOW.getTime() + HOUR_MS));

    const post = await createPost();
    const session = (expiresAt: Date) =>
      db.feedSession.create({
        data: { userId: user.id, expiresAt, impressions: { create: { postId: post.id } } },
      });
    const longExpired = await session(ago(8 * DAY_MS));
    await session(ago(6 * DAY_MS));
    await session(new Date(NOW.getTime() + HOUR_MS));

    await db.rateLimitBucket.createMany({
      data: [
        { key: "reports:old", windowStart: ago(DAY_MS + HOUR_MS), count: 3 },
        { key: "reports:current", windowStart: ago(HOUR_MS), count: 1 },
      ],
    });

    const orphan = await createMedia();
    await db.mediaAsset.update({
      where: { id: orphan.id },
      data: { createdAt: ago(25 * HOUR_MS) },
    });
    await createMedia();

    const deletedUser = await createUser({ emailVerified: null });
    await db.user.update({ where: { id: deletedUser.id }, data: { createdAt: ago(31 * DAY_MS) } });

    const first = await runDailyJobs({ now: NOW, provider });

    expect(counts(first)).toEqual({
      "delete-accounts": 1,
      "purge-auth-tokens": 2,
      "purge-feed-sessions": 1,
      "purge-rate-limit-buckets": 1,
      "delete-orphaned-media": 1,
    });
    expect((await db.authToken.findMany()).map((row) => row.tokenHash)).toEqual(["valid"]);
    expect(await db.feedSession.count()).toBe(2);
    expect(await db.feedImpression.count({ where: { sessionId: longExpired.id } })).toBe(0);
    expect((await db.rateLimitBucket.findMany()).map((row) => row.key)).toEqual([
      "reports:current",
    ]);
    expect(provider.deleted).toEqual([orphan.publicId]);

    const second = await runDailyJobs({ now: NOW, provider });

    expect(second.every((outcome) => outcome.ok && outcome.count === 0)).toBe(true);
  });

  it("keeps running the other jobs when one fails, and reports the failure", async () => {
    const provider = createFakeMediaProvider();
    provider.deleteAsset = async () => {
      throw new Error("Cloudinary is down");
    };
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const orphan = await createMedia();
    await db.mediaAsset.update({ where: { id: orphan.id }, data: { createdAt: ago(2 * DAY_MS) } });
    const user = await createUser();
    await db.authToken.create({
      data: {
        userId: user.id,
        type: "PASSWORD_RESET",
        tokenHash: "expired",
        expiresAt: ago(HOUR_MS),
      },
    });

    const outcomes = await runDailyJobs({ now: NOW, provider });

    expect(counts(outcomes)).toMatchObject({
      "purge-auth-tokens": 1,
      "delete-orphaned-media": "Cloudinary is down",
    });
    expect(outcomes.find((outcome) => outcome.job === "delete-orphaned-media")?.ok).toBe(false);
  });
});
