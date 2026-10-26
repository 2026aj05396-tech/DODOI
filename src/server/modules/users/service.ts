import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { SignInInput } from "@/lib/schemas/auth";
import { verifyPassword } from "@/server/auth/password";
import { db } from "@/server/db/client";
import { serverEnv } from "@/server/lib/env";
import { logger } from "@/server/lib/logger";
import { enforceRateLimit, type RateLimitRule } from "@/server/lib/rate-limit";

import { chooseAvailableUsername, isUniqueViolation, toDisplayName } from "./new-profile";
import {
  claimUnverifiedAccount,
  findAuthUserByAccount,
  findAuthUserById,
  findPasswordCredentialsByEmail,
  findSessionUserById,
  findUserForLinking,
  findUserIdByAccount,
  insertOAuthAccount,
  insertUserWithProfile,
  promoteVerifiedUserToAdmin,
} from "./repository";

/** SECURITY_AND_PRIVACY §6: sign-in, 10 per 15 minutes per IP. */
export const SIGN_IN_IP_RATE_LIMIT: RateLimitRule = {
  name: "signin-ip",
  limit: 10,
  windowSeconds: 15 * 60,
};

/** SECURITY_AND_PRIVACY §6: sign-in, 5 per 15 minutes per email. */
export const SIGN_IN_EMAIL_RATE_LIMIT: RateLimitRule = {
  name: "signin-email",
  limit: 5,
  windowSeconds: 15 * 60,
};

const GOOGLE_PROVIDER = "google";
/** Concurrent first sign-ins can collide on email, account or username; each retry re-reads. */
const RESOLVE_ATTEMPTS = 3;

export type PasswordSignInResult =
  | { outcome: "signed-in"; userId: string }
  /** Wrong password or unknown email: identical in result and timing (§2.5). */
  | { outcome: "invalid" }
  /** The account exists but signs in with Google only (PO decision: say so, §2.5). */
  | { outcome: "no-password" };

/**
 * Email/password sign-in. Throws `RateLimitError` when the IP or the email is over its limit.
 */
export async function authenticateWithPassword(
  input: SignInInput,
  clientIp: string,
): Promise<PasswordSignInResult> {
  await enforceRateLimit(SIGN_IN_IP_RATE_LIMIT, clientIp);
  await enforceRateLimit(SIGN_IN_EMAIL_RATE_LIMIT, input.email);

  const user = await findPasswordCredentialsByEmail(input.email);
  const matches = await verifyPassword(user?.passwordHash ?? null, input.password);
  if (user && matches) return { outcome: "signed-in", userId: user.id };
  if (user && user.passwordHash === null) return { outcome: "no-password" };
  return { outcome: "invalid" };
}

export type GoogleIdentity = {
  /** Google's stable user id (`sub`). */
  providerAccountId: string;
  /** Auth.js account type for the provider, e.g. "oidc". */
  accountType: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
};

export type GoogleSignInResult = {
  userId: string;
  /** existing: account already linked · linked: joined to a password account · created: new user. */
  outcome: "existing" | "linked" | "created";
};

async function resolveInTransaction(
  tx: Prisma.TransactionClient,
  identity: GoogleIdentity,
  email: string,
): Promise<GoogleSignInResult> {
  const linkedUserId = await findUserIdByAccount(GOOGLE_PROVIDER, identity.providerAccountId, tx);
  if (linkedUserId) return { userId: linkedUserId, outcome: "existing" };

  const account = {
    type: identity.accountType,
    provider: GOOGLE_PROVIDER,
    providerAccountId: identity.providerAccountId,
  };

  // Same email as an existing account: link automatically, Google has verified the email (OD-09).
  const existingUser = await findUserForLinking(email, tx);
  if (existingUser) {
    if (existingUser.emailVerified === null) {
      await claimUnverifiedAccount(existingUser.id, tx);
    }
    await insertOAuthAccount({ ...account, userId: existingUser.id }, tx);
    return { userId: existingUser.id, outcome: "linked" };
  }

  const displayName = toDisplayName(identity.name, email);
  const username = await chooseAvailableUsername(displayName, email, tx);

  const user = await insertUserWithProfile({ email, username, displayName }, tx);
  await insertOAuthAccount({ ...account, userId: user.id }, tx);
  return { userId: user.id, outcome: "created" };
}

/**
 * Maps a Google sign-in to a dodoi user, creating or linking as needed (SECURITY_AND_PRIVACY §2.6).
 * Returns null when Google has not verified the email: such a sign-in is refused.
 * New users get a profile with the Google name as display name; the Google photo is not imported.
 */
export async function resolveGoogleSignIn(
  identity: GoogleIdentity,
): Promise<GoogleSignInResult | null> {
  if (!identity.emailVerified) return null;
  const email = identity.email.trim().toLowerCase();

  for (let attempt = 1; ; attempt += 1) {
    try {
      const result = await db.$transaction((tx) => resolveInTransaction(tx, identity, email));
      if (result.outcome !== "existing") {
        logger.info(`Google sign-in ${result.outcome} an account`, { userId: result.userId });
      }
      return result;
    } catch (error) {
      if (!isUniqueViolation(error) || attempt >= RESOLVE_ATTEMPTS) throw error;
    }
  }
}

export type AuthUser = { id: string; email: string; emailVerified: Date | null };

/** Lookups for the Auth.js adapter (src/server/auth/adapter.ts). */
export async function getAuthUserById(id: string): Promise<AuthUser | null> {
  return findAuthUserById(id);
}

export async function getAuthUserByAccount(
  provider: string,
  providerAccountId: string,
): Promise<AuthUser | null> {
  return findAuthUserByAccount(provider, providerAccountId);
}

export type SessionUser = {
  id: string;
  role: "USER" | "ADMIN";
  sessionVersion: number;
  isEmailVerified: boolean;
  isAgeConfirmed: boolean;
  hasCompletedOnboarding: boolean;
};

/** Current state of a signed-in user, read on every request; null if the user no longer exists. */
export async function getSessionUser(userId: string): Promise<SessionUser | null> {
  const user = await findSessionUserById(userId);
  if (!user) return null;
  return {
    id: user.id,
    role: user.role,
    sessionVersion: user.sessionVersion,
    isEmailVerified: user.emailVerified !== null,
    isAgeConfirmed: user.ageConfirmedAt !== null,
    hasCompletedOnboarding: user.onboardingCompletedAt !== null,
  };
}

/**
 * Makes the configured owner account an ADMIN after it signs in (roadmap P1-04). Only a verified
 * email counts, so registering that address without proving ownership grants nothing.
 */
export async function promoteSeedAdminIfMatching(
  userId: string,
  seedAdminEmail: string | undefined = serverEnv.SEED_ADMIN_EMAIL,
): Promise<boolean> {
  if (!seedAdminEmail) return false;
  const promoted = await promoteVerifiedUserToAdmin(userId, seedAdminEmail);
  if (promoted) logger.info("Promoted SEED_ADMIN_EMAIL account to ADMIN", { userId });
  return promoted;
}
