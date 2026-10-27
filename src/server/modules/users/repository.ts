import "server-only";

import type { AuthTokenType, ExperienceLevel, Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db/client";

type Client = Prisma.TransactionClient | typeof db;

/** Fields needed to validate a session on every request (SECURITY_AND_PRIVACY §2.4). */
export async function findSessionUserById(id: string) {
  return db.user.findUnique({
    where: { id },
    select: {
      id: true,
      role: true,
      sessionVersion: true,
      emailVerified: true,
      ageConfirmedAt: true,
      onboardingCompletedAt: true,
    },
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

/** Whether an account uses this email, and whether it can sign in with a password. */
export async function findExistingAccountByEmail(email: string, client: Client) {
  const user = await client.user.findUnique({
    where: { email },
    select: { passwordHash: true },
  });
  return user ? { hasPassword: user.passwordHash !== null } : null;
}

/** New email/password account: unverified email, age already confirmed at registration. */
export async function insertPasswordUserWithProfile(
  data: { email: string; passwordHash: string; username: string; displayName: string },
  client: Client,
) {
  return client.user.create({
    data: {
      email: data.email,
      passwordHash: data.passwordHash,
      ageConfirmedAt: new Date(),
      profile: { create: { username: data.username, displayName: data.displayName } },
    },
    select: { id: true },
  });
}

/** Replaces any unused token of this type for the user, so only the newest link works. */
export async function replaceAuthToken(
  data: { userId: string; type: AuthTokenType; tokenHash: string; expiresAt: Date },
  client: Client = db,
) {
  await client.authToken.deleteMany({
    where: { userId: data.userId, type: data.type, usedAt: null },
  });
  await client.authToken.create({ data });
}

/**
 * Marks a valid token used and returns its user id; null if the token is unknown, expired or
 * already used. The conditional update makes two simultaneous uses impossible.
 */
export async function consumeAuthToken(
  type: AuthTokenType,
  tokenHash: string,
  now: Date,
  client: Client,
): Promise<string | null> {
  const { count } = await client.authToken.updateMany({
    where: { tokenHash, type, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  });
  if (count === 0) return null;
  const token = await client.authToken.findUnique({
    where: { tokenHash },
    select: { userId: true },
  });
  return token?.userId ?? null;
}

export async function markEmailVerified(userId: string, client: Client) {
  await client.user.updateMany({
    where: { id: userId, emailVerified: null },
    data: { emailVerified: new Date() },
  });
}

export async function findAccountState(userId: string) {
  return db.user.findUnique({
    where: { id: userId },
    select: { email: true, emailVerified: true, ageConfirmedAt: true },
  });
}

export async function setAgeConfirmed(userId: string) {
  await db.user.updateMany({
    where: { id: userId, ageConfirmedAt: null },
    data: { ageConfirmedAt: new Date() },
  });
}

/** Removes the account and, by cascade, its profile, Google link and tokens. */
export async function deleteUserById(userId: string) {
  await db.user.deleteMany({ where: { id: userId } });
}

export async function findPasswordStateByEmail(email: string) {
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });
  return user ? { id: user.id, hasPassword: user.passwordHash !== null } : null;
}

export async function findPasswordHashById(userId: string) {
  return db.user.findUnique({
    where: { id: userId },
    select: { email: true, passwordHash: true },
  });
}

export async function findEmailById(userId: string, client: Client) {
  const user = await client.user.findUnique({ where: { id: userId }, select: { email: true } });
  return user?.email ?? null;
}

/**
 * Sets a new password and signs out every session (`sessionVersion` + 1). With `verifyEmail`
 * (reset link: the person proved they own the inbox) an unverified email becomes verified.
 */
export async function replacePassword(
  userId: string,
  passwordHash: string,
  { verifyEmail }: { verifyEmail: boolean },
  client: Client = db,
) {
  const user = await client.user.update({
    where: { id: userId },
    data: { passwordHash, sessionVersion: { increment: 1 } },
    select: { emailVerified: true },
  });
  if (verifyEmail && user.emailVerified === null) {
    await client.user.update({ where: { id: userId }, data: { emailVerified: new Date() } });
  }
}

export type UserSkillRow = {
  skillId: string;
  isInterest: boolean;
  canHelp: boolean;
  wantsToLearn: boolean;
  level: ExperienceLevel | null;
};

const userSkillSelect = {
  skillId: true,
  isInterest: true,
  canHelp: true,
  wantsToLearn: true,
  level: true,
} as const;

export async function findUserSkillRows(userId: string): Promise<UserSkillRow[]> {
  return db.userSkill.findMany({
    where: { userId },
    select: userSkillSelect,
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Replaces the user's whole skill set in one transaction. Skills that stay keep their original
 * `createdAt`, so "most recently added interests" (feed chips, FEED-13) survive later edits.
 */
export async function replaceUserSkillRows(userId: string, rows: UserSkillRow[]): Promise<void> {
  await db.$transaction(async (tx) => {
    const existing = await tx.userSkill.findMany({
      where: { userId },
      select: { skillId: true, createdAt: true },
    });
    const addedAt = new Map(existing.map((row) => [row.skillId, row.createdAt]));
    await tx.userSkill.deleteMany({ where: { userId } });
    await tx.userSkill.createMany({
      data: rows.map((row) => ({ ...row, userId, createdAt: addedAt.get(row.skillId) })),
    });
  });
}

/** The user's interests with their level, most recently added first (feed, P1-21). */
export async function findInterestRows(userId: string) {
  return db.userSkill.findMany({
    where: { userId, isInterest: true },
    orderBy: [{ createdAt: "desc" }, { skillId: "asc" }],
    select: { skillId: true, level: true },
  });
}

export async function findOnboardingRow(userId: string) {
  return db.user.findUnique({
    where: { id: userId },
    select: { onboardingStep: true, onboardingCompletedAt: true },
  });
}

export async function updateOnboardingStep(userId: string, step: number) {
  await db.user.update({ where: { id: userId }, data: { onboardingStep: step } });
}

/** Sets the completion time once; later calls keep the first one. */
export async function markOnboardingComplete(userId: string, lastStep: number) {
  await db.user.updateMany({
    where: { id: userId, onboardingCompletedAt: null },
    data: { onboardingCompletedAt: new Date(), onboardingStep: lastStep },
  });
}

/** Profile data for creator rows, with what decides whether it may be shown. */
export async function findCreatorRows(userIds: string[]) {
  return db.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      deletionRequestedAt: true,
      profile: {
        select: {
          username: true,
          displayName: true,
          isHidden: true,
          visibility: true,
          avatar: { select: { publicId: true } },
        },
      },
    },
  });
}

export async function findUsersByUsernames(usernames: string[]) {
  return db.profile.findMany({
    where: { username: { in: usernames } },
    select: { userId: true, username: true },
  });
}

export async function findUsernamesByIds(userIds: string[]) {
  return db.profile.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, username: true },
  });
}

export async function findDisplayName(userId: string): Promise<string | null> {
  const profile = await db.profile.findUnique({ where: { userId }, select: { displayName: true } });
  return profile?.displayName ?? null;
}

const ownProfileSelect = {
  username: true,
  displayName: true,
  bio: true,
  avatarMediaId: true,
  visibility: true,
  usernameChangedAt: true,
} as const;

export async function findOwnProfile(userId: string) {
  return db.profile.findUnique({ where: { userId }, select: ownProfileSelect });
}

export async function updateProfileRow(userId: string, data: Prisma.ProfileUncheckedUpdateInput) {
  return db.profile.update({ where: { userId }, data, select: ownProfileSelect });
}

/** A profile by username (stored lowercase) with what decides who may see it. */
export async function findProfileByUsername(username: string) {
  return db.profile.findUnique({
    where: { username },
    select: {
      userId: true,
      username: true,
      displayName: true,
      bio: true,
      visibility: true,
      isHidden: true,
      avatar: { select: { publicId: true } },
      user: { select: { deletionRequestedAt: true } },
    },
  });
}
