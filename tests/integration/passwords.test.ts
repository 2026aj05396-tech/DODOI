import { decode } from "next-auth/jwt";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { refreshSessionToken } from "@/server/auth/callbacks";
import { hashPassword } from "@/server/auth/password";
import { issueSessionCookie } from "@/server/auth/session-cookie";
import { db } from "@/server/db/client";
import { RateLimitError } from "@/server/lib/errors";
import {
  authenticateWithPassword,
  changePassword,
  requestPasswordReset,
  resetPassword,
} from "@/server/modules/users";

import { resetDatabase } from "../helpers/database";
import { actorFor, createUser } from "../helpers/factories";
import { createFakeEmailSender, tokenFromEmail } from "../helpers/fake-email";

// Password reset and change (AUTH-05, AUTH-07; roadmap P1-06, TESTING_STRATEGY §4).

const NOW = new Date("2026-10-24T10:00:00Z");
const OLD_PASSWORD = "the old password";
const NEW_PASSWORD = "a brand new password";
let oldHash: string;

let ipCounter = 0;
const freshIp = () => `198.51.100.${(ipCounter += 1)}`;

async function signInToken(userId: string) {
  return refreshSessionToken({ token: {}, user: { id: userId } });
}

async function requestReset(emailAddress: string) {
  const email = createFakeEmailSender();
  await requestPasswordReset({ email: emailAddress }, freshIp(), { email, now: NOW });
  return email;
}

describe("passwords", () => {
  beforeAll(async () => {
    oldHash = await hashPassword(OLD_PASSWORD);
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

  describe("requestPasswordReset", () => {
    it("emails a 1-hour reset link to an account with a password", async () => {
      const user = await createUser({ email: "maker@example.test", passwordHash: oldHash });

      const email = await requestReset("maker@example.test");

      expect(email.sent).toHaveLength(1);
      expect(email.sent[0]).toMatchObject({
        to: "maker@example.test",
        tag: "password-reset",
        subject: "Reset your dodoi password",
      });
      const token = await db.authToken.findFirstOrThrow({ where: { userId: user.id } });
      expect(token).toMatchObject({
        type: "PASSWORD_RESET",
        expiresAt: new Date("2026-10-24T11:00:00Z"),
      });
    });

    it("sends nothing for an unknown email, with the same (empty) result", async () => {
      const email = await requestReset("nobody@example.test");

      expect(email.sent).toEqual([]);
      expect(await db.authToken.count()).toBe(0);
    });

    it("offers a Google-only account to set a password", async () => {
      await createUser({ email: "google@example.test", passwordHash: null });

      const email = await requestReset("google@example.test");

      expect(email.sent[0]?.subject).toBe("Set your dodoi password");
    });

    it("makes earlier links stop working when a new one is requested", async () => {
      await createUser({ email: "maker@example.test", passwordHash: oldHash });
      const first = await requestReset("maker@example.test");
      const second = await requestReset("maker@example.test");

      await expect(
        resetPassword({ token: tokenFromEmail(first.sent[0]), newPassword: NEW_PASSWORD }, NOW),
      ).rejects.toMatchObject({ code: "TOKEN_INVALID_OR_EXPIRED" });
      await resetPassword(
        { token: tokenFromEmail(second.sent[0]), newPassword: NEW_PASSWORD },
        NOW,
      );
    });

    it("allows 3 requests per email per hour", async () => {
      for (let index = 0; index < 3; index += 1) await requestReset("anyone@example.test");

      await expect(requestReset("anyone@example.test")).rejects.toBeInstanceOf(RateLimitError);
    });

    it("allows 5 requests per IP per hour", async () => {
      const ip = "203.0.113.20";
      const email = createFakeEmailSender();
      for (let index = 0; index < 5; index += 1) {
        await requestPasswordReset({ email: `p${index}@example.test` }, ip, { email, now: NOW });
      }

      await expect(
        requestPasswordReset({ email: "p9@example.test" }, ip, { email, now: NOW }),
      ).rejects.toBeInstanceOf(RateLimitError);
    });

    it("does the account lookup and email in the deferred task (after the response)", async () => {
      await createUser({ email: "maker@example.test", passwordHash: oldHash });
      const email = createFakeEmailSender();
      const deferred: (() => Promise<void>)[] = [];

      await requestPasswordReset({ email: "maker@example.test" }, freshIp(), {
        email,
        now: NOW,
        defer: (task) => {
          deferred.push(task);
        },
      });

      expect(email.sent).toEqual([]);
      await deferred[0]?.();
      expect(email.sent).toHaveLength(1);
    });
  });

  describe("resetPassword", () => {
    it("sets the new password, signs out every session and works only once", async () => {
      const user = await createUser({ email: "maker@example.test", passwordHash: oldHash });
      const session = await signInToken(user.id);
      const token = tokenFromEmail((await requestReset("maker@example.test")).sent[0]);

      await resetPassword({ token, newPassword: NEW_PASSWORD }, NOW);

      expect(await refreshSessionToken({ token: session ?? {} })).toBeNull();
      const signIn = (password: string) =>
        authenticateWithPassword({ email: "maker@example.test", password }, freshIp());
      expect(await signIn(NEW_PASSWORD)).toMatchObject({ outcome: "signed-in" });
      expect(await signIn(OLD_PASSWORD)).toEqual({ outcome: "invalid" });
      await expect(
        resetPassword({ token, newPassword: "another new password" }, NOW),
      ).rejects.toMatchObject({ status: 400, code: "TOKEN_INVALID_OR_EXPIRED" });
    });

    it("rejects a link after 1 hour", async () => {
      await createUser({ email: "maker@example.test", passwordHash: oldHash });
      const token = tokenFromEmail((await requestReset("maker@example.test")).sent[0]);

      await expect(
        resetPassword({ token, newPassword: NEW_PASSWORD }, new Date("2026-10-24T11:00:01Z")),
      ).rejects.toMatchObject({ code: "TOKEN_INVALID_OR_EXPIRED" });
    });

    it("refuses the email as password without using up the link", async () => {
      await createUser({ email: "maker1234@example.test", passwordHash: oldHash });
      const token = tokenFromEmail((await requestReset("maker1234@example.test")).sent[0]);

      await expect(
        resetPassword({ token, newPassword: "Maker1234@example.test" }, NOW),
      ).rejects.toMatchObject({
        fields: { newPassword: "Your password can't be your email address." },
      });
      await resetPassword({ token, newPassword: NEW_PASSWORD }, NOW);
    });

    it("lets a Google-only account set a password, and verifies an unverified email", async () => {
      const google = await createUser({ email: "google@example.test", passwordHash: null });
      const unverified = await createUser({
        email: "new@example.test",
        passwordHash: oldHash,
        emailVerified: null,
      });

      for (const address of ["google@example.test", "new@example.test"]) {
        const token = tokenFromEmail((await requestReset(address)).sent[0]);
        await resetPassword({ token, newPassword: NEW_PASSWORD }, NOW);
      }

      const [googleAfter, unverifiedAfter] = await Promise.all([
        db.user.findUniqueOrThrow({ where: { id: google.id } }),
        db.user.findUniqueOrThrow({ where: { id: unverified.id } }),
      ]);
      expect(googleAfter.passwordHash).toMatch(/^\$argon2id\$/);
      expect(unverifiedAfter.emailVerified).not.toBeNull();
    });
  });

  describe("changePassword", () => {
    it("changes the password and signs out other sessions; a re-issued cookie keeps this one", async () => {
      const user = await createUser({ email: "maker@example.test", passwordHash: oldHash });
      const otherDevice = await signInToken(user.id);

      await changePassword(actorFor(user), {
        currentPassword: OLD_PASSWORD,
        newPassword: NEW_PASSWORD,
      });

      expect(await refreshSessionToken({ token: otherDevice ?? {} })).toBeNull();
      const cookie = await issueSessionCookie(user.id);
      const claims = await decode({
        token: cookie?.value,
        secret: process.env.AUTH_SECRET ?? "",
        salt: cookie?.name ?? "",
      });
      expect(cookie).toMatchObject({
        name: "authjs.session-token",
        options: { httpOnly: true, sameSite: "lax", path: "/" },
      });
      expect(await refreshSessionToken({ token: claims ?? {} })).toMatchObject({
        sub: user.id,
        sv: 1,
      });
    });

    it("rejects a wrong current password on its field", async () => {
      const user = await createUser({ passwordHash: oldHash });

      await expect(
        changePassword(actorFor(user), {
          currentPassword: "not it at all",
          newPassword: NEW_PASSWORD,
        }),
      ).rejects.toMatchObject({
        status: 400,
        code: "INVALID_CURRENT_PASSWORD",
        fields: { currentPassword: "That isn't your current password." },
      });
    });

    it("answers NO_PASSWORD_SET for a Google-only account", async () => {
      const user = await createUser({ passwordHash: null });

      await expect(
        changePassword(actorFor(user), { currentPassword: "anything", newPassword: NEW_PASSWORD }),
      ).rejects.toMatchObject({ status: 400, code: "NO_PASSWORD_SET" });
    });

    it("allows 5 attempts per 15 minutes", async () => {
      const user = await createUser({ passwordHash: oldHash });
      const attempt = () =>
        changePassword(actorFor(user), {
          currentPassword: "wrong guess",
          newPassword: NEW_PASSWORD,
        });
      for (let index = 0; index < 5; index += 1) await attempt().catch(() => undefined);

      await expect(attempt()).rejects.toBeInstanceOf(RateLimitError);
    });
  });
});
