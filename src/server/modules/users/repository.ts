import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db/client";

type Client = Prisma.TransactionClient | typeof db;

/** Fields needed to validate a session on every request (SECURITY_AND_PRIVACY §2.4). */
export async function findSessionUserById(id: string) {
  return db.user.findUnique({
    where: { id },
    select: { id: true, role: true, sessionVersion: true, emailVerified: true },
  });
}

const authUserSelect = { id: true, email: true, emailVerified: true } as const;

export async function findAuthUserById(id: string) {
  return db.user.findUnique({ where: { id }, select: authUserSelect });
}

export async function findAuthUserByAccount(provider: string, providerAccountId: string) {
  const account = await db.account.findUnique({
    where: { provider_providerAccountId: { provider, providerAccountId } },
    select: { user: { select: authUserSelect } },
  });
  return account?.user ?? null;
}

export async function findPasswordCredentialsByEmail(email: string) {
  return db.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });
}

export async function findUserIdByAccount(
  provider: string,
  providerAccountId: string,
  client: Client = db,
) {
  const account = await client.account.findUnique({
    where: { provider_providerAccountId: { provider, providerAccountId } },
    select: { userId: true },
  });
  return account?.userId ?? null;
}

export async function findUserForLinking(email: string, client: Client) {
  return client.user.findUnique({
    where: { email },
    select: { id: true, emailVerified: true },
  });
}

export async function findTakenUsernames(
  candidates: string[],
  client: Client,
): Promise<Set<string>> {
  const rows = await client.profile.findMany({
    where: { username: { in: candidates } },
    select: { username: true },
  });
  return new Set(rows.map((row) => row.username));
}

/**
 * For a never-verified account claimed through Google: marks the email verified, removes the
 * password and signs out every session. Whoever set that password never proved they own the email,
 * so they must not keep access (account pre-hijacking, OD-09).
 */
export async function claimUnverifiedAccount(userId: string, client: Client) {
  await client.user.update({
    where: { id: userId },
    data: { emailVerified: new Date(), passwordHash: null, sessionVersion: { increment: 1 } },
  });
}

export async function insertOAuthAccount(
  data: { userId: string; type: string; provider: string; providerAccountId: string },
  client: Client,
) {
  await client.account.create({ data });
}

export async function insertUserWithProfile(
  data: { email: string; username: string; displayName: string },
  client: Client,
) {
  return client.user.create({
    data: {
      email: data.email,
      emailVerified: new Date(),
      profile: { create: { username: data.username, displayName: data.displayName } },
    },
    select: { id: true },
  });
}

/** Promotes a user to ADMIN only if they are a verified USER with this email. Returns true if changed. */
export async function promoteVerifiedUserToAdmin(userId: string, email: string): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const { count } = await tx.user.updateMany({
      where: { id: userId, email, role: "USER", emailVerified: { not: null } },
      data: { role: "ADMIN" },
    });
    if (count === 0) return false;
    await tx.auditLog.create({
      data: {
        actorId: null,
        action: "user.promote_admin",
        targetType: "user",
        targetId: userId,
        metadata: { reason: "SEED_ADMIN_EMAIL" },
      },
    });
    return true;
  });
}
