import type { JWT } from "next-auth/jwt";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  allowSignIn,
  authorizeCredentials,
  RateLimitedSignIn,
  refreshSessionToken,
  toSession,
} from "@/server/auth/callbacks";
import { hashPassword } from "@/server/auth/password";
import { db } from "@/server/db/client";
import { RateLimitError } from "@/server/lib/errors";
import {
  authenticateWithPassword,
  promoteSeedAdminIfMatching,
  resolveGoogleSignIn,
  type GoogleIdentity,
} from "@/server/modules/users";

import { resetDatabase } from "../helpers/database";
import { createUser } from "../helpers/factories";

// Auth rules of SECURITY_AND_PRIVACY §2 and roadmap P1-04 (TESTING_STRATEGY §4).

const PASSWORD = "correct horse battery";
let passwordHash: string;

function googleIdentity(overrides: Partial<GoogleIdentity> = {}): GoogleIdentity {
  return {
    providerAccountId: "google-sub-1",
    accountType: "oidc",
    email: "aanya@example.test",
    emailVerified: true,
    name: "Aanya Sharma",
    ...overrides,
  };
}

function requestFrom(ip: string): Request {
  return new Request("http://localhost:3000/api/auth/callback/credentials", {
    method: "POST",
    headers: { "x-forwarded-for": ip },
  });
}

describe("auth", () => {
  beforeAll(async () => {
    passwordHash = await hashPassword(PASSWORD);
  });

  beforeEach(async () => {
    await resetDatabase();
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await resetDatabase();
    await db.$disconnect();
  });

  describe("email and password sign-in", () => {
    it("returns the user id for the right password, matching the email case-insensitively", async () => {
      const user = await createUser({ email: "maker@example.test", passwordHash });

      const result = await authorizeCredentials(
        { email: " Maker@Example.test ", password: PASSWORD },
        requestFrom("198.51.100.1"),
      );

      expect(result).toEqual({ id: user.id });
    });

    it("refuses a wrong password, an unknown email and a Google-only account the same way", async () => {
      await createUser({ email: "maker@example.test", passwordHash });
      await createUser({ email: "google-only@example.test", passwordHash: null });
      const ip = "198.51.100.2";

      const attempts = await Promise.all([
        authenticateWithPassword({ email: "maker@example.test", password: "wrong password" }, ip),
        authenticateWithPassword({ email: "nobody@example.test", password: PASSWORD }, ip),
        authenticateWithPassword({ email: "google-only@example.test", password: PASSWORD }, ip),
      ]);

      expect(attempts).toEqual([null, null, null]);
    });

    it("rejects malformed input without touching the database", async () => {
      const result = await authorizeCredentials(
        { email: "not-an-email", password: "" },
        requestFrom("198.51.100.3"),
      );

      expect(result).toBeNull();
      expect(await db.rateLimitBucket.count()).toBe(0);
    });

    it("allows 5 attempts per email in 15 minutes, then reports rate_limited", async () => {
      await createUser({ email: "maker@example.test", passwordHash });
      const attempt = (index: number) =>
        authorizeCredentials(
          { email: "maker@example.test", password: "wrong password" },
          requestFrom(`198.51.100.${10 + index}`),
        );

      for (let index = 0; index < 5; index += 1) {
        expect(await attempt(index)).toBeNull();
      }
      const blocked = attempt(5);

      await expect(blocked).rejects.toBeInstanceOf(RateLimitedSignIn);
      await expect(blocked).rejects.toMatchObject({ code: "rate_limited" });
    });

    it("allows 10 attempts per IP in 15 minutes across different emails", async () => {
      const ip = "203.0.113.50";
      for (let index = 0; index < 10; index += 1) {
        await authenticateWithPassword(
          { email: `person${index}@example.test`, password: PASSWORD },
          ip,
        );
      }

      await expect(
        authenticateWithPassword({ email: "another@example.test", password: PASSWORD }, ip),
      ).rejects.toBeInstanceOf(RateLimitError);
    });
  });

  describe("Google sign-in", () => {
    it("creates a verified user with a profile from the Google name, without the photo", async () => {
      const result = await resolveGoogleSignIn(googleIdentity());

      expect(result?.outcome).toBe("created");
      const user = await db.user.findUniqueOrThrow({
        where: { id: result?.userId },
        include: { profile: true, accounts: true },
      });
      expect(user.email).toBe("aanya@example.test");
      expect(user.emailVerified).not.toBeNull();
      expect(user.passwordHash).toBeNull();
      expect(user.profile).toMatchObject({
        username: "aanya-sharma",
        displayName: "Aanya Sharma",
        avatarMediaId: null,
      });
      expect(user.accounts).toEqual([
        expect.objectContaining({
          provider: "google",
          providerAccountId: "google-sub-1",
          access_token: null,
          refresh_token: null,
          id_token: null,
        }),
      ]);
    });

    it("signs a returning Google user into the same account", async () => {
      const first = await resolveGoogleSignIn(googleIdentity());
      const second = await resolveGoogleSignIn(googleIdentity({ name: "Renamed" }));

      expect(second).toEqual({ userId: first?.userId, outcome: "existing" });
      expect(await db.user.count()).toBe(1);
    });

    it("refuses a Google account whose email Google has not verified", async () => {
      const result = await resolveGoogleSignIn(googleIdentity({ emailVerified: false }));

      expect(result).toBeNull();
      expect(await db.user.count()).toBe(0);
    });

    it("adds 4 digits when the username is taken", async () => {
      await resolveGoogleSignIn(googleIdentity());

      const result = await resolveGoogleSignIn(
        googleIdentity({ providerAccountId: "google-sub-2", email: "other@example.test" }),
      );

      const profile = await db.profile.findUniqueOrThrow({ where: { userId: result?.userId } });
      expect(profile.username).toMatch(/^aanya-sharma-\d{4}$/);
    });

    it("links to a verified password account and keeps its password and sessions", async () => {
      const existing = await createUser({ email: "aanya@example.test", passwordHash });

      const result = await resolveGoogleSignIn(googleIdentity({ email: "Aanya@Example.test" }));

      expect(result).toEqual({ userId: existing.id, outcome: "linked" });
      const user = await db.user.findUniqueOrThrow({ where: { id: existing.id } });
      expect(user.passwordHash).toBe(passwordHash);
      expect(user.sessionVersion).toBe(existing.sessionVersion);
      expect(await db.account.count({ where: { userId: existing.id } })).toBe(1);
    });

    it("claims an unverified password account: removes the password and ends its sessions", async () => {
      const existing = await createUser({
        email: "aanya@example.test",
        emailVerified: null,
        passwordHash,
      });

      const result = await resolveGoogleSignIn(googleIdentity());

      expect(result).toEqual({ userId: existing.id, outcome: "linked" });
      const user = await db.user.findUniqueOrThrow({ where: { id: existing.id } });
      expect(user.passwordHash).toBeNull();
      expect(user.emailVerified).not.toBeNull();
      expect(user.sessionVersion).toBe(existing.sessionVersion + 1);
    });

    it("lets the signIn callback refuse unverified Google emails and allow credentials", async () => {
      const account = {
        provider: "google",
        type: "oidc" as const,
        providerAccountId: "google-sub-9",
      };

      expect(
        await allowSignIn({
          account,
          profile: { email: "x@example.test", email_verified: false, name: "X" },
        }),
      ).toBe(false);
      expect(
        await allowSignIn({
          account: { provider: "credentials", type: "credentials", providerAccountId: "u" },
        }),
      ).toBe(true);
    });
  });

  describe("session token", () => {
    it("builds minimal claims at sign-in and exposes only the actor in the session", async () => {
      const user = await createUser({ passwordHash });

      const token = await refreshSessionToken({ token: {}, user: { id: user.id } });

      expect(token).toEqual({ sub: user.id, sv: 0, role: "USER", ev: true });
      const session = toSession({
        session: { expires: "2026-11-22T00:00:00.000Z" },
        token: token ?? {},
      });
      expect(session).toEqual({
        expires: "2026-11-22T00:00:00.000Z",
        actor: { id: user.id, role: "USER", isEmailVerified: true },
      });
    });

    it("rejects a token whose sessionVersion is stale (e.g. after a password reset)", async () => {
      const user = await createUser();
      const token = await refreshSessionToken({ token: {}, user: { id: user.id } });
      await db.user.update({
        where: { id: user.id },
        data: { sessionVersion: { increment: 1 } },
      });

      expect(await refreshSessionToken({ token: token ?? {} })).toBeNull();
    });

    it("rejects a token for a deleted user and a token with missing claims", async () => {
      const user = await createUser();
      const token = await refreshSessionToken({ token: {}, user: { id: user.id } });
      await db.user.delete({ where: { id: user.id } });

      expect(await refreshSessionToken({ token: token ?? {} })).toBeNull();
      expect(await refreshSessionToken({ token: { sub: "someone" } as JWT })).toBeNull();
    });

    it("refreshes role and verification from the database on each request", async () => {
      const user = await createUser({ emailVerified: null });
      const token = await refreshSessionToken({ token: {}, user: { id: user.id } });
      await db.user.update({
        where: { id: user.id },
        data: { role: "ADMIN", emailVerified: new Date() },
      });

      const refreshed = await refreshSessionToken({ token: token ?? {} });

      expect(refreshed).toMatchObject({ role: "ADMIN", ev: true });
    });
  });

  describe("SEED_ADMIN_EMAIL promotion", () => {
    it("promotes the matching verified account at sign-in and records it in the audit log", async () => {
      // vitest.config.mts sets SEED_ADMIN_EMAIL=owner@example.test.
      const owner = await createUser({ email: "owner@example.test" });

      const token = await refreshSessionToken({ token: {}, user: { id: owner.id } });

      expect(token?.role).toBe("ADMIN");
      const audit = await db.auditLog.findMany({ where: { targetId: owner.id } });
      expect(audit).toEqual([
        expect.objectContaining({ action: "user.promote_admin", targetType: "user" }),
      ]);
    });

    it("does not promote an unverified account with that email", async () => {
      const owner = await createUser({ email: "owner@example.test", emailVerified: null });

      expect(await promoteSeedAdminIfMatching(owner.id, "owner@example.test")).toBe(false);
      expect((await db.user.findUniqueOrThrow({ where: { id: owner.id } })).role).toBe("USER");
    });

    it("does nothing for other emails or when no admin email is configured", async () => {
      const user = await createUser();

      expect(await promoteSeedAdminIfMatching(user.id, "owner@example.test")).toBe(false);
      expect(await promoteSeedAdminIfMatching(user.id, undefined)).toBe(false);
      expect(await db.auditLog.count()).toBe(0);
    });
  });
});
