import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { DeleteAccountInput } from "@/lib/schemas/auth";
import { verifyPassword } from "@/server/auth/password";
import type { Actor } from "@/server/lib/actor";
import { ForbiddenError, UnauthenticatedError, ValidationError } from "@/server/lib/errors";
import { logger } from "@/server/lib/logger";
import { enforceRateLimit, type RateLimitRule } from "@/server/lib/rate-limit";

import {
  clearDeletionRequested,
  deleteSpentAuthTokens,
  deleteUserIfDue,
  findDeletionState,
  findUserIdsDueForDeletion,
  markDeletionRequested,
} from "./repository";

// Account deletion lifecycle (AUTH-08, F-14, SECURITY_AND_PRIVACY §7.3). A request deactivates the
// account at once: every session is signed out, the profile is hidden and left out of search.
// Signing in again within 14 days shows only the "scheduled for deletion" screen, where it can be
// cancelled. Afterwards the daily jobs (P1-33) hard-delete it.

const DAY_MS = 24 * 60 * 60 * 1000;
export const ACCOUNT_DELETION_GRACE_DAYS = 14;
/** Never-verified accounts are deleted after this many days, without a grace period (OD-08). */
export const UNVERIFIED_ACCOUNT_MAX_AGE_DAYS = 30;
/** Google-only accounts confirm by signing in with Google again within this window (API §3). */
export const REAUTHENTICATION_WINDOW_SECONDS = 5 * 60;

/** Guesses at the password with a signed-in session (same budget as a password change). */
export const ACCOUNT_DELETION_RATE_LIMIT: RateLimitRule = {
  name: "account-delete-user",
  limit: 5,
  windowSeconds: 15 * 60,
};

/** When an account deactivated at `requestedAt` is deleted. */
export function deletionDateFor(requestedAt: Date): Date {
  return new Date(requestedAt.getTime() + ACCOUNT_DELETION_GRACE_DAYS * DAY_MS);
}

/** Whether the session signed in recently enough to delete a Google-only account. */
export function isRecentSignIn(signedInAt: number | null, now = new Date()): boolean {
  if (signedInAt === null) return false;
  const age = now.getTime() / 1000 - signedInAt;
  return age >= 0 && age <= REAUTHENTICATION_WINDOW_SECONDS;
}

/**
 * DELETE /api/account. Accounts with a password confirm with it; Google-only accounts must have
 * signed in again within the last 5 minutes (403 REAUTHENTICATION_REQUIRED). Admin accounts can't
 * be deleted here (403 ADMIN_ACCOUNT). Returns when the account will be deleted.
 */
export async function requestAccountDeletion(
  actor: Actor,
  input: DeleteAccountInput,
  now = new Date(),
): Promise<{ deletionScheduledFor: Date }> {
  if (!actor) throw new UnauthenticatedError();
  const account = await findDeletionState(actor.id);
  if (!account) throw new UnauthenticatedError();
  if (account.deletionRequestedAt) {
    return { deletionScheduledFor: deletionDateFor(account.deletionRequestedAt) };
  }
  if (account.role === "ADMIN") {
    throw new ForbiddenError("Admin accounts can't be deleted from settings.", {
      code: "ADMIN_ACCOUNT",
    });
  }

  if (account.passwordHash !== null) {
    await enforceRateLimit(ACCOUNT_DELETION_RATE_LIMIT, actor.id, { now });
    const matches =
      input.password !== undefined && (await verifyPassword(account.passwordHash, input.password));
    if (!matches) {
      throw new ValidationError(undefined, {
        code: "INVALID_PASSWORD",
        fields: { password: "That isn't your password." },
      });
    }
  } else if (!isRecentSignIn(actor.signedInAt, now)) {
    throw new ForbiddenError("Sign in with Google again to confirm it's you.", {
      code: "REAUTHENTICATION_REQUIRED",
    });
  }

  await markDeletionRequested(actor.id, now);
  logger.info("Account deactivated; deletion scheduled", { userId: actor.id });
  return { deletionScheduledFor: deletionDateFor(now) };
}

/** POST /api/account/deletion/cancel: reactivates the account. Does nothing if none was scheduled. */
export async function cancelAccountDeletion(actor: Actor): Promise<void> {
  if (!actor) throw new UnauthenticatedError();
  if (await clearDeletionRequested(actor.id)) {
    logger.info("Account deletion cancelled", { userId: actor.id });
  }
}

/** When the signed-in user's account will be deleted, or null if no deletion is scheduled. */
export async function getDeletionScheduledFor(actor: Actor): Promise<Date | null> {
  if (!actor) return null;
  const account = await findDeletionState(actor.id);
  return account?.deletionRequestedAt ? deletionDateFor(account.deletionRequestedAt) : null;
}

function deletionCutoffs(now: Date) {
  return {
    requestedBefore: new Date(now.getTime() - ACCOUNT_DELETION_GRACE_DAYS * DAY_MS),
    unverifiedCreatedBefore: new Date(now.getTime() - UNVERIFIED_ACCOUNT_MAX_AGE_DAYS * DAY_MS),
  };
}

/** Daily jobs: accounts past the grace period and never-verified accounts older than 30 days. */
export async function getAccountsDueForDeletion(now = new Date()): Promise<string[]> {
  return findUserIdsDueForDeletion(deletionCutoffs(now));
}

/**
 * Hard-deletes the user inside the caller's transaction if still due (they may have cancelled
 * since `getAccountsDueForDeletion`). Returns false, deleting nothing, when no longer due.
 */
export async function deleteAccountIfDue(
  userId: string,
  tx: Prisma.TransactionClient,
  now = new Date(),
): Promise<boolean> {
  return deleteUserIfDue(userId, deletionCutoffs(now), tx);
}

/** Daily cleanup (P1-33): auth tokens that are expired or already used. */
export async function purgeSpentAuthTokens(now = new Date()): Promise<number> {
  return deleteSpentAuthTokens(now);
}
