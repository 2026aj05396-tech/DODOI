import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/server/db/client";

// Guards the hand-written parts of the init migration (DATABASE_SCHEMA §6).
describe("database schema", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("has the pg_trgm extension for typo-tolerant search", async () => {
    const rows = await db.$queryRaw<{ extname: string }[]>`
      SELECT extname FROM pg_extension WHERE extname = 'pg_trgm'
    `;

    expect(rows).toHaveLength(1);
  });

  it("has GIN indexes for full-text and trigram search", async () => {
    const rows = await db.$queryRaw<{ indexname: string }[]>`
      SELECT indexname FROM pg_indexes
      WHERE indexname IN (
        'post_search_vector_idx', 'post_title_trgm_idx', 'skill_name_trgm_idx',
        'profile_username_trgm_idx', 'profile_display_name_trgm_idx'
      )
      ORDER BY indexname
    `;

    expect(rows.map((row) => row.indexname)).toEqual([
      "post_search_vector_idx",
      "post_title_trgm_idx",
      "profile_display_name_trgm_idx",
      "profile_username_trgm_idx",
      "skill_name_trgm_idx",
    ]);
  });

  it("matches a misspelled skill name through trigram similarity", async () => {
    const [row] = await db.$queryRaw<{ score: number }[]>`
      SELECT similarity('crochet', 'crochte') AS score
    `;

    expect(row?.score).toBeGreaterThan(0.3);
  });
});
