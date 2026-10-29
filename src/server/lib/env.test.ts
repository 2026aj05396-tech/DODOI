import { describe, expect, it } from "vitest";

import { parseServerEnv } from "@/server/lib/env";

const CRON_SECRET = "cron-secret-for-tests-at-least-32-characters";

const validEnv = {
  APP_ENV: "local",
  DATABASE_URL: "postgresql://dodoi:dodoi@localhost:5433/dodoi",
  AUTH_SECRET: "test-secret-that-is-at-least-32-characters-long",
  AUTH_URL: "http://localhost:3000",
  AUTH_GOOGLE_ID: "google-client-id",
  AUTH_GOOGLE_SECRET: "google-client-secret",
  EMAIL_FROM: "dodoi <onboarding@resend.dev>",
  CLOUDINARY_CLOUD_NAME: "demo-cloud",
  CLOUDINARY_API_KEY: "123",
  CLOUDINARY_API_SECRET: "test-secret",
};

describe("parseServerEnv", () => {
  it("accepts a complete, valid environment", () => {
    expect(parseServerEnv(validEnv)).toEqual({
      ...validEnv,
      SMTP_HOST: "smtp.gmail.com",
      AI_ENABLED: false,
      AI_PROVIDER: "gemini",
      AI_TIER: "free",
      AI_DAILY_REQUEST_CAP: 500,
      AI_INPUT_PRICE_PER_M: 0,
      AI_OUTPUT_PRICE_PER_M: 0,
    });
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
      parseServerEnv({
        ...validEnv,
        APP_ENV: "production",
        RESEND_API_KEY: "re_key",
        CRON_SECRET: CRON_SECRET,
      }),
    ).toMatchObject({ RESEND_API_KEY: "re_key" });
  });

  it("accepts SMTP instead of RESEND_API_KEY outside local development (P1-35)", () => {
    const hosted = { ...validEnv, APP_ENV: "test", CRON_SECRET };
    const smtp = { SMTP_USER: "dodoi.test@gmail.com", SMTP_PASSWORD: "app-password" };
    expect(parseServerEnv({ ...hosted, ...smtp })).toMatchObject(smtp);
    expect(() => parseServerEnv({ ...hosted, SMTP_USER: smtp.SMTP_USER })).toThrow(/SMTP_PASSWORD/);
  });

  it("requires a long CRON_SECRET outside local development (P1-35)", () => {
    const hosted = { ...validEnv, APP_ENV: "test", RESEND_API_KEY: "re_key" };
    expect(() => parseServerEnv(hosted)).toThrow(/CRON_SECRET/);
    expect(() => parseServerEnv({ ...hosted, CRON_SECRET: "short" })).toThrow(/CRON_SECRET/);
    expect(parseServerEnv({ ...hosted, CRON_SECRET: CRON_SECRET })).toMatchObject({ CRON_SECRET });
    expect(parseServerEnv(validEnv).CRON_SECRET).toBeUndefined();
  });

  it("allows the mock Cloudinary API only for local test runs", () => {
    expect(() =>
      parseServerEnv({
        ...validEnv,
        CLOUDINARY_API_BASE: "http://localhost:3198/v1_1",
        APP_ENV: "production",
        RESEND_API_KEY: "re_key",
      }),
    ).toThrow(/CLOUDINARY_API_BASE/);
  });

  it("allows the mock Google issuer only for local test runs", () => {
    const issuer = { AUTH_GOOGLE_ISSUER: "http://localhost:3199" };
    expect(parseServerEnv({ ...validEnv, ...issuer }).AUTH_GOOGLE_ISSUER).toBe(
      "http://localhost:3199",
    );
    expect(() =>
      parseServerEnv({ ...validEnv, ...issuer, APP_ENV: "production", RESEND_API_KEY: "re_key" }),
    ).toThrow(/AUTH_GOOGLE_ISSUER/);
  });

  it("treats an empty RESEND_API_KEY as unset", () => {
    expect(parseServerEnv({ ...validEnv, RESEND_API_KEY: "" }).RESEND_API_KEY).toBeUndefined();
  });

  it("rejects a DATABASE_URL that is not a URL", () => {
    expect(() => parseServerEnv({ ...validEnv, DATABASE_URL: "localhost" })).toThrow(
      /DATABASE_URL/,
    );
  });

  describe("AI companion (P4-01)", () => {
    const ai = { AI_ENABLED: "true", GEMINI_API_KEY: "key", AI_MODEL: "a-model" };
    const hosted = {
      ...validEnv,
      APP_ENV: "test",
      CRON_SECRET,
      RESEND_API_KEY: "re_test_key_value",
    };

    it("is off by default and needs no key", () => {
      expect(parseServerEnv(validEnv)).toMatchObject({ AI_ENABLED: false });
    });

    it("needs the key and the model when switched on", () => {
      expect(() => parseServerEnv({ ...validEnv, AI_ENABLED: "true" })).toThrow(
        /GEMINI_API_KEY[\s\S]*AI_MODEL/,
      );
      expect(parseServerEnv({ ...validEnv, ...ai })).toMatchObject({ AI_ENABLED: true });
    });

    it("allows the free tier in local and test, but not in production (it lets Google use submitted content)", () => {
      const production = { ...hosted, APP_ENV: "production" };
      expect(parseServerEnv({ ...validEnv, ...ai, AI_TIER: "free" })).toMatchObject({
        AI_TIER: "free",
      });
      expect(parseServerEnv({ ...hosted, ...ai, AI_TIER: "free" })).toMatchObject({
        AI_TIER: "free",
      });
      expect(() => parseServerEnv({ ...production, ...ai, AI_TIER: "free" })).toThrow(/AI_TIER/);
      expect(parseServerEnv({ ...production, ...ai, AI_TIER: "paid" })).toMatchObject({
        AI_TIER: "paid",
      });
    });

    it("does not check the tier while the companion is off", () => {
      expect(parseServerEnv({ ...hosted, APP_ENV: "production", AI_TIER: "free" })).toMatchObject({
        AI_ENABLED: false,
      });
    });
  });
});
