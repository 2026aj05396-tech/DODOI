import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/server/db/client";

describe("database client", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("connects to the test database", async () => {
    const [row] = await db.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`;

    expect(row?.name).toBe("dodoi_test");
  });
});
