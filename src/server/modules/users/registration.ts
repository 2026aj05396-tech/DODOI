import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { RegisterInput, VerifyEmailInput } from "@/lib/schemas/auth";
import type { RegisterResponse } from "@/lib/types/auth";
import { hashPassword } from "@/server/auth/password";
import { db } from "@/server/db/client";
import { emailSender as defaultEmailSender, type EmailSender } from "@/server/integrations/email";
import type { Actor } from "@/server/lib/actor";
import {
  ConflictError,
  ServiceUnavailableError,
  UnauthenticatedError,
  UnprocessableError,
  ValidationError,
} from "@/server/lib/errors";
import { logger } from "@/server/lib/logger";
import { enforceRateLimit, type RateLimitRule } from "@/server/lib/rate-limit";

import { checkDateOfBirth } from "./age";
import { appUrl, sendQuietly } from "./delivery";
import { verificationEmail } from "./emails";
import { chooseAvailableUsername, isUniqueViolation, toDisplayName } from "./new-profile";
import {
  consumeAuthToken,
  findAccountState,
  findExistingAccountByEmail,
  insertPasswordUserWithProfile,
  markEmailVerified,
  replaceAuthToken,
} from "./repository";
import { generateToken, hashToken } from "./tokens";

// Email registration and verification (AUTH-01, AUTH-04, AUTH-11; SECURITY_AND_PRIVACY §2.3–2.5).

/** SECURITY_AND_PRIVACY §6: register, 5 per hour per IP. */
export const REGISTER_RATE_LIMIT: RateLimitRule = {
  name: "register-ip",
  limit: 5,
  windowSeconds: 60 * 60,
};

/** SECURITY_AND_PRIVACY §6: resend verification, 3 per hour per user. */
export const RESEND_VERIFICATION_RATE_LIMIT: RateLimitRule = {
  name: "verify-resend-user",
  limit: 3,
  windowSeconds: 60 * 60,
};

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const CREATE_ATTEMPTS = 3;

export const EMAIL_ALREADY_REGISTERED_MESSAGE = "This email is already registered.";
export const EMAIL_REGISTERED_WITH_GOOGLE_MESSAGE = "Looks like you signed up with Google.";

export const UNDER_MINIMUM_AGE_MESSAGE =
  "dodoi is for adults 18 and over, so we can't create an account for you.";

type EmailOptions = { email?: EmailSender; now?: Date };

function requireActorId(actor: Actor): string {
  if (!actor) throw new UnauthenticatedError();
  return actor.id;
}

/** 400 with a field message; the typed value is never echoed back or logged. */
export function invalidDateOfBirth(): ValidationError {
  return new ValidationError(undefined, {
    fields: { dateOfBirth: "Check your date of birth." },
  });
}

function verifyUrl(rawToken: string): string {
  return appUrl("/verify-email", { token: rawToken });
}

async function issueVerificationToken(
  userId: string,
  now: Date,
  client: Prisma.TransactionClient | typeof db = db,
): Promise<string> {
  const { rawToken, tokenHash } = generateToken();
  await replaceAuthToken(
    {
      userId,
      type: "EMAIL_VERIFICATION",
      tokenHash,
      expiresAt: new Date(now.getTime() + VERIFICATION_TOKEN_TTL_MS),
    },
    client,
  );
  return rawToken;
}

type CreateResult = { created: true; rawToken: string } | { created: false; hasPassword: boolean };

async function createPasswordAccount(
  email: string,
  passwordHash: string,
  now: Date,
): Promise<CreateResult> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await db.$transaction(async (tx): Promise<CreateResult> => {
        const existing = await findExistingAccountByEmail(email, tx);
        if (existing) return { created: false, hasPassword: existing.hasPassword };
        const displayName = toDisplayName(null, email);
        const username = await chooseAvailableUsername(displayName, email, tx);
        const user = await insertPasswordUserWithProfile(
          { email, passwordHash, username, displayName },
          tx,
        );
        return { created: true, rawToken: await issueVerificationToken(user.id, now, tx) };
      });
    } catch (error) {
      // Someone registered the same email (or took the username) at the same moment: re-check.
      if (!isUniqueViolation(error) || attempt >= CREATE_ATTEMPTS) throw error;
    }
  }
}

/**
 * Registers an email/password account and emails a verification link. A taken email answers 409
 * so the form can send the person the right way (PO decision; accepted enumeration risk,
 * SECURITY_AND_PRIVACY §2.5): EMAIL_ALREADY_REGISTERED (sign in) or EMAIL_REGISTERED_WITH_GOOGLE.
 * Under 18: 422 and nothing is stored. The date of birth is only checked, never stored or logged.
 */
export async function registerWithPassword(
  input: RegisterInput,
  clientIp: string,
  { email: sender = defaultEmailSender, now = new Date() }: EmailOptions = {},
): Promise<RegisterResponse> {
  await enforceRateLimit(REGISTER_RATE_LIMIT, clientIp);

  const age = checkDateOfBirth(input.dateOfBirth, now);
  if (age === "invalid") throw invalidDateOfBirth();
  if (age === "under-minimum-age") {
    throw new UnprocessableError(UNDER_MINIMUM_AGE_MESSAGE, { code: "UNDER_MINIMUM_AGE" });
  }

  const passwordHash = await hashPassword(input.password);
  const result = await createPasswordAccount(input.email, passwordHash, now);

  if (!result.created) {
    const [code, message] = result.hasPassword
      ? ["EMAIL_ALREADY_REGISTERED", EMAIL_ALREADY_REGISTERED_MESSAGE]
      : ["EMAIL_REGISTERED_WITH_GOOGLE", EMAIL_REGISTERED_WITH_GOOGLE_MESSAGE];
    throw new ConflictError(message, { code, fields: { email: message } });
  }
  await sendQuietly(sender, verificationEmail(input.email, verifyUrl(result.rawToken)));
  return { status: "verification_sent" };
}

/** Confirms the email from a verification link. Tokens work once and expire after 24 hours. */
export async function verifyEmail(input: VerifyEmailInput, now = new Date()): Promise<void> {
  const verified = await db.$transaction(async (tx) => {
    const userId = await consumeAuthToken("EMAIL_VERIFICATION", hashToken(input.token), now, tx);
    if (userId) await markEmailVerified(userId, tx);
    return userId !== null;
  });
  if (!verified) {
    throw new ValidationError("This link has expired or was already used.", {
      code: "TOKEN_INVALID_OR_EXPIRED",
    });
  }
}

/** Sends a fresh verification link; earlier links stop working. No-op when already verified. */
export async function resendVerificationEmail(
  actor: Actor,
  { email: sender = defaultEmailSender, now = new Date() }: EmailOptions = {},
): Promise<void> {
  const userId = requireActorId(actor);
  await enforceRateLimit(RESEND_VERIFICATION_RATE_LIMIT, userId, { now });

  const account = await findAccountState(userId);
  if (!account || account.emailVerified) return;
  const rawToken = await issueVerificationToken(userId, now);
  try {
    await sender.send(verificationEmail(account.email, verifyUrl(rawToken)));
  } catch (error) {
    // The person asked for this email, so tell them it failed (unlike at registration).
    logger.error("Email could not be sent", { tag: "email-verification", error });
    throw new ServiceUnavailableError(
      "We couldn't send the email right now. Please try again in a few minutes.",
      { code: "EMAIL_NOT_SENT" },
    );
  }
}
