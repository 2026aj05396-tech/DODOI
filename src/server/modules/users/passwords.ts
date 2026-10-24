import "server-only";

import {
  PASSWORD_IS_EMAIL_MESSAGE,
  type ChangePasswordInput,
  type PasswordResetConfirmInput,
  type PasswordResetRequestInput,
} from "@/lib/schemas/auth";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { db } from "@/server/db/client";
import { emailSender as defaultEmailSender, type EmailSender } from "@/server/integrations/email";
import type { Actor } from "@/server/lib/actor";
import { UnauthenticatedError, ValidationError } from "@/server/lib/errors";
import { logger } from "@/server/lib/logger";
import { enforceRateLimit, type RateLimitRule } from "@/server/lib/rate-limit";

import { appUrl, sendQuietly } from "./delivery";
import { passwordResetEmail } from "./emails";
import {
  consumeAuthToken,
  findEmailById,
  findPasswordHashById,
  findPasswordStateByEmail,
  replaceAuthToken,
  replacePassword,
} from "./repository";
import { generateToken, hashToken } from "./tokens";

// Password reset and change (AUTH-05, AUTH-07; SECURITY_AND_PRIVACY §2.2–2.5).

/** SECURITY_AND_PRIVACY §6: password reset request, 5 per hour per IP. */
export const PASSWORD_RESET_IP_RATE_LIMIT: RateLimitRule = {
  name: "password-reset-ip",
  limit: 5,
  windowSeconds: 60 * 60,
};

/** SECURITY_AND_PRIVACY §6: password reset request, 3 per hour per email. */
export const PASSWORD_RESET_EMAIL_RATE_LIMIT: RateLimitRule = {
  name: "password-reset-email",
  limit: 3,
  windowSeconds: 60 * 60,
};

/** Guesses at the current password with a signed-in session (same budget as sign-in per email). */
export const PASSWORD_CHANGE_RATE_LIMIT: RateLimitRule = {
  name: "password-change-user",
  limit: 5,
  windowSeconds: 15 * 60,
};

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

/** Runs work after the response is sent (route handlers pass Next.js `after`); tests run it inline. */
type Defer = (task: () => Promise<void>) => void | Promise<void>;
const runNow: Defer = (task) => task();

type ResetRequestOptions = { email?: EmailSender; now?: Date; defer?: Defer };

/**
 * Starts a password reset. Always succeeds the same way (§2.5): the lookup, token and email happen
 * after the response, so neither the answer nor its timing shows whether the email has an account.
 * Unknown emails get nothing; accounts without a password get a "set a password" email (F-04).
 */
export async function requestPasswordReset(
  input: PasswordResetRequestInput,
  clientIp: string,
  {
    email: sender = defaultEmailSender,
    now = new Date(),
    defer = runNow,
  }: ResetRequestOptions = {},
): Promise<void> {
  await enforceRateLimit(PASSWORD_RESET_IP_RATE_LIMIT, clientIp, { now });
  await enforceRateLimit(PASSWORD_RESET_EMAIL_RATE_LIMIT, input.email, { now });

  await defer(async () => {
    const account = await findPasswordStateByEmail(input.email);
    if (!account) return;
    const { rawToken, tokenHash } = generateToken();
    await replaceAuthToken({
      userId: account.id,
      type: "PASSWORD_RESET",
      tokenHash,
      expiresAt: new Date(now.getTime() + RESET_TOKEN_TTL_MS),
    });
    await sendQuietly(
      sender,
      passwordResetEmail(input.email, appUrl("/reset-password", { token: rawToken }), {
        hasPassword: account.hasPassword,
      }),
    );
  });
}

/**
 * Sets a new password from a reset link (single use, 1 hour) and signs out every session. Using
 * the link proves the person owns the inbox, so an unverified email becomes verified.
 */
export async function resetPassword(
  input: PasswordResetConfirmInput,
  now = new Date(),
): Promise<void> {
  const passwordHash = await hashPassword(input.newPassword);
  const userId = await db.$transaction(async (tx) => {
    const tokenUserId = await consumeAuthToken("PASSWORD_RESET", hashToken(input.token), now, tx);
    if (!tokenUserId) {
      throw new ValidationError("This link has expired or was already used.", {
        code: "TOKEN_INVALID_OR_EXPIRED",
      });
    }
    // Throwing here rolls the transaction back, so the link stays usable for a better password.
    if ((await findEmailById(tokenUserId, tx)) === input.newPassword.trim().toLowerCase()) {
      throw new ValidationError(undefined, { fields: { newPassword: PASSWORD_IS_EMAIL_MESSAGE } });
    }
    await replacePassword(tokenUserId, passwordHash, { verifyEmail: true }, tx);
    return tokenUserId;
  });
  logger.info("Password reset; all sessions signed out", { userId });
}

/**
 * Changes the password of the signed-in user and signs out every session (`sessionVersion` + 1);
 * the route then issues a fresh cookie for the current one. Google-only accounts have no current
 * password: 400 NO_PASSWORD_SET (they set one through the reset email).
 */
export async function changePassword(actor: Actor, input: ChangePasswordInput): Promise<void> {
  if (!actor) throw new UnauthenticatedError();
  await enforceRateLimit(PASSWORD_CHANGE_RATE_LIMIT, actor.id);

  const account = await findPasswordHashById(actor.id);
  if (!account) throw new UnauthenticatedError();
  if (account.passwordHash === null) {
    throw new ValidationError(
      "Your account doesn't have a password yet. Use “Forgot password?” to set one.",
      { code: "NO_PASSWORD_SET" },
    );
  }
  if (!(await verifyPassword(account.passwordHash, input.currentPassword))) {
    throw new ValidationError(undefined, {
      code: "INVALID_CURRENT_PASSWORD",
      fields: { currentPassword: "That isn't your current password." },
    });
  }
  if (input.newPassword.trim().toLowerCase() === account.email) {
    throw new ValidationError(undefined, { fields: { newPassword: PASSWORD_IS_EMAIL_MESSAGE } });
  }

  await replacePassword(actor.id, await hashPassword(input.newPassword), { verifyEmail: false });
  logger.info("Password changed; other sessions signed out", { userId: actor.id });
}
