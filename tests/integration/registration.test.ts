import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { hashPassword } from "@/server/auth/password";
import { db } from "@/server/db/client";
import { RateLimitError } from "@/server/lib/errors";
import {
  authenticateWithPassword,
  confirmAge,
  registerWithPassword,
  resendVerificationEmail,
  verifyEmail,
} from "@/server/modules/users";

import { resetDatabase } from "../helpers/database";
import { actorFor, createUser } from "../helpers/factories";
import { createFakeEmailSender, tokenFromEmail } from "../helpers/fake-email";

// Registration, verification and the 18+ check (AUTH-01, AUTH-04, AUTH-11; roadmap P1-05).

const NOW = new Date("2026-10-23T10:00:00Z");
const ADULT_DOB = "1998-04-17";
const PASSWORD = "a long enough password";

function input(overrides: Partial<{ email: string; password: string; dateOfBirth: string }> = {}) {
  return {
    email: "aanya.k@example.test",
    password: PASSWORD,
    dateOfBirth: ADULT_DOB,
    ...overrides,
  };
}

let ipCounter = 0;
/** Each test registers from its own IP so the 5-per-hour limit only applies where tested. */
const freshIp = () => `198.51.100.${(ipCounter += 1)}`;

describe("registration", () => {
  beforeEach(async () => {
    await resetDatabase();
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await resetDatabase();
    await db.$disconnect();
  });

  describe("registerWithPassword", () => {
    it("creates an unverified, age-confirmed account with a profile and sends a verification link", async () => {
      const email = createFakeEmailSender();

      const result = await registerWithPassword(input(), freshIp(), { email, now: NOW });

      expect(result).toEqual({ status: "verification_sent" });
      const user = await db.user.findUniqueOrThrow({
        where: { email: "aanya.k@example.test" },
        include: { profile: true, authTokens: true },
      });
      expect(user.emailVerified).toBeNull();
      expect(user.ageConfirmedAt).not.toBeNull();
      expect(user.passwordHash).toMatch(/^\$argon2id\$/);
      expect(user.profile).toMatchObject({ username: "aanya-k", displayName: "aanya.k" });
      expect(user.authTokens).toEqual([
        expect.objectContaining({
          type: "EMAIL_VERIFICATION",
          expiresAt: new Date("2026-10-24T10:00:00Z"),
          usedAt: null,
        }),
      ]);
      expect(email.sent).toHaveLength(1);
      expect(email.sent[0]).toMatchObject({
        to: "aanya.k@example.test",
        tag: "email-verification",
      });
      // Only the hash is stored; the raw token exists only in the email.
      expect(user.authTokens[0]?.tokenHash).not.toBe(tokenFromEmail(email.sent[0]));
    });

    it("never stores the date of birth", async () => {
      await registerWithPassword(input(), freshIp(), { email: createFakeEmailSender(), now: NOW });

      const row = await db.$queryRaw<Record<string, unknown>[]>`SELECT * FROM "user"`;
      expect(
        JSON.stringify(row, (_key, value: unknown) =>
          typeof value === "bigint" ? String(value) : value,
        ),
      ).not.toContain("1998-04-17");
    });

    it("lets the new account sign in straight away (unverified users keep private features)", async () => {
      await registerWithPassword(input(), freshIp(), { email: createFakeEmailSender(), now: NOW });

      const signedIn = await authenticateWithPassword(
        { email: "aanya.k@example.test", password: PASSWORD },
        freshIp(),
      );

      expect(signedIn).not.toBeNull();
    });

    it("answers 409 EMAIL_ALREADY_REGISTERED for a taken email and leaves that account alone", async () => {
      const existing = await createUser({
        email: "aanya.k@example.test",
        passwordHash: await hashPassword("the original password"),
      });
      const email = createFakeEmailSender();

      await expect(
        registerWithPassword(input(), freshIp(), {
          email,
          now: NOW,
        }),
      ).rejects.toMatchObject({
        status: 409,
        code: "EMAIL_ALREADY_REGISTERED",
        message: "This email is already registered.",
        fields: { email: "This email is already registered." },
      });
      const user = await db.user.findUniqueOrThrow({ where: { id: existing.id } });
      expect(user.passwordHash).toBe(existing.passwordHash);
      expect(await db.user.count()).toBe(1);
      expect(email.sent).toEqual([]);
    });

    it("answers 409 EMAIL_REGISTERED_WITH_GOOGLE for an account that has no password", async () => {
      await createUser({ email: "aanya.k@example.test", passwordHash: null });

      await expect(
        registerWithPassword(input(), freshIp(), { email: createFakeEmailSender(), now: NOW }),
      ).rejects.toMatchObject({
        status: 409,
        code: "EMAIL_REGISTERED_WITH_GOOGLE",
        fields: { email: "Looks like you signed up with Google." },
      });
    });

    it("refuses under-18s with 422 UNDER_MINIMUM_AGE and stores nothing", async () => {
      const email = createFakeEmailSender();

      await expect(
        registerWithPassword(input({ dateOfBirth: "2008-10-24" }), freshIp(), { email, now: NOW }),
      ).rejects.toMatchObject({ status: 422, code: "UNDER_MINIMUM_AGE" });
      expect(await db.user.count()).toBe(0);
      expect(email.sent).toEqual([]);
    });

    it("rejects an impossible date of birth as a field error", async () => {
      await expect(
        registerWithPassword(input({ dateOfBirth: "2030-01-01" }), freshIp(), {
          email: createFakeEmailSender(),
          now: NOW,
        }),
      ).rejects.toMatchObject({
        status: 400,
        fields: { dateOfBirth: "Check your date of birth." },
      });
    });

    it("allows 5 registrations per IP per hour", async () => {
      const ip = "203.0.113.77";
      const email = createFakeEmailSender();
      for (let index = 0; index < 5; index += 1) {
        await registerWithPassword(input({ email: `maker${index}@example.test` }), ip, {
          email,
          now: NOW,
        });
      }

      await expect(
        registerWithPassword(input({ email: "maker9@example.test" }), ip, { email, now: NOW }),
      ).rejects.toBeInstanceOf(RateLimitError);
    });
  });

  describe("verifyEmail", () => {
    async function registerAndGetToken(): Promise<string> {
      const email = createFakeEmailSender();
      await registerWithPassword(input(), freshIp(), { email, now: NOW });
      return tokenFromEmail(email.sent[0]);
    }

    it("verifies the email once; the same link then fails", async () => {
      const token = await registerAndGetToken();

      await verifyEmail({ token }, NOW);

      const user = await db.user.findUniqueOrThrow({ where: { email: "aanya.k@example.test" } });
      expect(user.emailVerified).not.toBeNull();
      await expect(verifyEmail({ token }, NOW)).rejects.toMatchObject({
        status: 400,
        code: "TOKEN_INVALID_OR_EXPIRED",
      });
    });

    it("rejects an expired link and an unknown token", async () => {
      const token = await registerAndGetToken();
      const afterExpiry = new Date("2026-10-24T10:00:01Z");

      await expect(verifyEmail({ token }, afterExpiry)).rejects.toMatchObject({
        code: "TOKEN_INVALID_OR_EXPIRED",
      });
      await expect(verifyEmail({ token: "not-a-real-token" }, NOW)).rejects.toMatchObject({
        code: "TOKEN_INVALID_OR_EXPIRED",
      });
    });

    it("lets only one of two simultaneous uses of a link succeed", async () => {
      const token = await registerAndGetToken();

      const results = await Promise.allSettled([
        verifyEmail({ token }, NOW),
        verifyEmail({ token }, NOW),
      ]);

      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    });
  });

  describe("resendVerificationEmail", () => {
    it("sends a new link and makes the earlier one stop working", async () => {
      const email = createFakeEmailSender();
      await registerWithPassword(input(), freshIp(), { email, now: NOW });
      const user = await db.user.findUniqueOrThrow({ where: { email: "aanya.k@example.test" } });

      await resendVerificationEmail(actorFor(user), { email, now: NOW });

      expect(email.sent).toHaveLength(2);
      await expect(
        verifyEmail({ token: tokenFromEmail(email.sent[0]) }, NOW),
      ).rejects.toMatchObject({
        code: "TOKEN_INVALID_OR_EXPIRED",
      });
      await verifyEmail({ token: tokenFromEmail(email.sent[1]) }, NOW);
    });

    it("answers 503 EMAIL_NOT_SENT when the email provider refuses the message", async () => {
      vi.spyOn(process.stderr, "write").mockImplementation(() => true);
      const user = await createUser({ emailVerified: null });
      const failing = {
        send: async () => {
          throw new Error("Resend rejected the email (403)");
        },
      };

      await expect(
        resendVerificationEmail(actorFor(user), { email: failing, now: NOW }),
      ).rejects.toMatchObject({ status: 503, code: "EMAIL_NOT_SENT" });
    });

    it("does nothing for an already verified account", async () => {
      const email = createFakeEmailSender();
      const user = await createUser();

      await resendVerificationEmail(actorFor(user), { email, now: NOW });

      expect(email.sent).toEqual([]);
    });

    it("allows 3 resends per user per hour", async () => {
      const email = createFakeEmailSender();
      const user = await createUser({ emailVerified: null });
      for (let index = 0; index < 3; index += 1) {
        await resendVerificationEmail(actorFor(user), { email, now: NOW });
      }

      await expect(
        resendVerificationEmail(actorFor(user), { email, now: NOW }),
      ).rejects.toBeInstanceOf(RateLimitError);
    });
  });

  describe("confirmAge (Google sign-ups)", () => {
    it("records the age check for an adult", async () => {
      const user = await createUser({ ageConfirmedAt: null });

      await confirmAge(actorFor(user), { dateOfBirth: ADULT_DOB }, NOW);

      const updated = await db.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(updated.ageConfirmedAt).not.toBeNull();
    });

    it("deletes the account of an under-18 and answers 422", async () => {
      const user = await createUser({ ageConfirmedAt: null });

      await expect(
        confirmAge(actorFor(user), { dateOfBirth: "2010-01-01" }, NOW),
      ).rejects.toMatchObject({ status: 422, code: "UNDER_MINIMUM_AGE" });
      expect(await db.user.count()).toBe(0);
    });

    it("leaves an already confirmed account alone, whatever date is sent", async () => {
      const user = await createUser();

      await confirmAge(actorFor(user), { dateOfBirth: "2010-01-01" }, NOW);

      expect(await db.user.count()).toBe(1);
    });
  });
});
