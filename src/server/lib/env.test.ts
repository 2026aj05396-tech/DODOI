import { describe, expect, it } from "vitest";

import { parseServerEnv } from "@/server/lib/env";

const validEnv = {
  APP_ENV: "local",
  DATABASE_URL: "postgresql://dodoi:dodoi@localhost:5433/dodoi",
};

describe("parseServerEnv", () => {
  it("accepts a complete, valid environment", () => {
    expect(parseServerEnv(validEnv)).toEqual(validEnv);
  });

  it("names every missing variable in one error", () => {
    expect(() => parseServerEnv({})).toThrow(/APP_ENV[\s\S]*DATABASE_URL/);
  });

  it("rejects an unknown APP_ENV", () => {
    expect(() => parseServerEnv({ ...validEnv, APP_ENV: "staging" })).toThrow(/APP_ENV/);
  });

  it("rejects a DATABASE_URL that is not a URL", () => {
    expect(() => parseServerEnv({ ...validEnv, DATABASE_URL: "localhost" })).toThrow(
      /DATABASE_URL/,
    );
  });
});
