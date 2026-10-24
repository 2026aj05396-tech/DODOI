import { describe, expect, it } from "vitest";

import { parseServerEnv } from "@/server/lib/env";

const validEnv = {
  APP_ENV: "local",
  DATABASE_URL: "postgresql://dodoi:dodoi@localhost:5433/dodoi",
  AUTH_SECRET: "test-secret-that-is-at-least-32-characters-long",
  AUTH_URL: "http://localhost:3000",
  AUTH_GOOGLE_ID: "google-client-id",
  AUTH_GOOGLE_SECRET: "google-client-secret",
  EMAIL_FROM: "dodoi <onboarding@resend.dev>",
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

  it("rejects a short AUTH_SECRET", () => {
    expect(() => parseServerEnv({ ...validEnv, AUTH_SECRET: "too-short" })).toThrow(/AUTH_SECRET/);
  });

  it("lowercases SEED_ADMIN_EMAIL so it matches stored emails", () => {
    expect(parseServerEnv({ ...validEnv, SEED_ADMIN_EMAIL: "Owner@Example.com" })).toMatchObject({
      SEED_ADMIN_EMAIL: "owner@example.com",
    });
  });

  it("requires RESEND_API_KEY outside local development", () => {
    expect(() => parseServerEnv({ ...validEnv, APP_ENV: "production" })).toThrow(/RESEND_API_KEY/);
    expect(
      parseServerEnv({ ...validEnv, APP_ENV: "production", RESEND_API_KEY: "re_key" }),
    ).toMatchObject({ RESEND_API_KEY: "re_key" });
  });

  it("treats an empty RESEND_API_KEY as unset", () => {
    expect(parseServerEnv({ ...validEnv, RESEND_API_KEY: "" }).RESEND_API_KEY).toBeUndefined();
  });

  it("rejects a DATABASE_URL that is not a URL", () => {
    expect(() => parseServerEnv({ ...validEnv, DATABASE_URL: "localhost" })).toThrow(
      /DATABASE_URL/,
    );
  });
});
