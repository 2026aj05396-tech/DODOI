import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { refreshSessionToken, toSession } from "@/server/auth/callbacks";
import { hashPassword } from "@/server/auth/password";
import { db } from "@/server/db/client";
import type { AuthenticatedActor } from "@/server/lib/actor";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/lib/errors";
import { deleteAccountsDue } from "@/server/modules/jobs";
import {
  cancelAccountDeletion,
  getDeletionScheduledFor,
  getProfileForView,
  requestAccountDeletion,
} from "@/server/modules/users";

import { resetDatabase } from "../helpers/database";
import { actorFor, createCreator, createPost, createSkill, createUser } from "../helpers/factories";
import { createFakeMediaProvider } from "../helpers/fake-media";

// Account deletion lifecycle (AUTH-08, P1-28; SECURITY_AND_PRIVACY §7.3, TESTING_STRATEGY §4).

const PASSWORD = "my long password";
const NOW = new Date("2026-10-27T10:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY_MS);
let passwordHash: string;

async function errorOf(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => null,
    (error: unknown) => error,
  );
}

function googleActor(user: { id: string }, signedInAt: Date | null): AuthenticatedActor {
  return {
    ...actorFor({ id: user.id, emailVerified: NOW, ageConfirmedAt: NOW }),
    signedInAt: signedInAt ? Math.floor(signedInAt.getTime() / 1000) : null,
  };
}

/** A user with a profile, as after sign-up. */
async function createMember(overrides: { passwordHash?: string | null } = {}) {
  const user = await createUser({ passwordHash: overrides.passwordHash ?? null });
  await db.profile.create({
    data: { userId: user.id, username: `member-${user.id.slice(-6)}`, displayName: "Member" },
  });
  return user;
}

describe("account deletion", () => {
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

  describe("requestAccountDeletion", () => {
    it("deactivates with the right password: signed out everywhere, profile hidden, 14 days", async () => {
      const user = await createMember({ passwordHash });
      const session = await refreshSessionToken({ token: {}, user: { id: user.id } });

      const result = await requestAccountDeletion(actorFor(user), { password: PASSWORD }, NOW);

      expect(result.deletionScheduledFor).toEqual(new Date(NOW.getTime() + 14 * DAY_MS));
      const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(row.deletionRequestedAt).toEqual(NOW);
      expect(row.sessionVersion).toBe(1);
      expect(await refreshSessionToken({ token: session ?? {} })).toBeNull();
      const username = (await db.profile.findUniqueOrThrow({ where: { userId: user.id } }))
        .username;
      const viewer = actorFor(await createUser());
      expect(await errorOf(getProfileForView(viewer, username))).toBeInstanceOf(NotFoundError);
    });

    it("refuses a wrong password and leaves the account active", async () => {
      const user = await createMember({ passwordHash });

      const error = await errorOf(
        requestAccountDeletion(actorFor(user), { password: "not my password" }, NOW),
      );

      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).code).toBe("INVALID_PASSWORD");
      expect((error as ValidationError).fields).toEqual({ password: "That isn't your password." });
      const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(row.deletionRequestedAt).toBeNull();
    });

    it("requires a password when the account has one", async () => {
      const user = await createMember({ passwordHash });

      const error = await errorOf(requestAccountDeletion(actorFor(user), {}, NOW));

      expect((error as ValidationError).code).toBe("INVALID_PASSWORD");
    });

    it("asks a Google-only account to sign in again unless it did within 5 minutes", async () => {
      const user = await createMember();

      for (const signedInAt of [null, new Date(NOW.getTime() - 6 * 60 * 1000)]) {
        const error = await errorOf(requestAccountDeletion(googleActor(user, signedInAt), {}, NOW));
        expect(error).toBeInstanceOf(ForbiddenError);
        expect((error as ForbiddenError).code).toBe("REAUTHENTICATION_REQUIRED");
      }

      const recent = new Date(NOW.getTime() - 2 * 60 * 1000);
      await requestAccountDeletion(googleActor(user, recent), {}, NOW);
      expect(await getDeletionScheduledFor(actorFor(user))).toEqual(
        new Date(NOW.getTime() + 14 * DAY_MS),
      );
    });

    it("refuses admin accounts", async () => {
      const admin = await createMember({ passwordHash });
      await db.user.update({ where: { id: admin.id }, data: { role: "ADMIN" } });

      const error = await errorOf(
        requestAccountDeletion(actorFor(admin, "ADMIN"), { password: PASSWORD }, NOW),
      );

      expect((error as ForbiddenError).code).toBe("ADMIN_ACCOUNT");
    });
  });

  describe("grace period", () => {
    it("signing in again gives a session marked as scheduled for deletion", async () => {
      const user = await createMember({ passwordHash });
      await requestAccountDeletion(actorFor(user), { password: PASSWORD }, NOW);

      const token = await refreshSessionToken({ token: {}, user: { id: user.id } });

      expect(token?.dl).toBe(true);
      const session = toSession({
        session: { expires: "2026-11-27T00:00:00.000Z" },
        token: token ?? {},
      });
      expect(session.actor?.isDeletionScheduled).toBe(true);
    });

    it("cancelling reactivates the account and keeps the session", async () => {
      const user = await createMember({ passwordHash });
      await requestAccountDeletion(actorFor(user), { password: PASSWORD }, NOW);
      const token = await refreshSessionToken({ token: {}, user: { id: user.id } });

      await cancelAccountDeletion(actorFor(user));

      expect(await getDeletionScheduledFor(actorFor(user))).toBeNull();
      const refreshed = await refreshSessionToken({ token: token ?? {} });
      expect(refreshed?.dl).toBe(false);
      // Idempotent.
      await cancelAccountDeletion(actorFor(user));
    });
  });

  describe("deleteAccountsDue (hard delete)", () => {
    it("deletes accounts past the grace period with their data; keeps custom skills and audit rows", async () => {
      const provider = createFakeMediaProvider();
      const user = await createMember();
      const avatar = await db.mediaAsset.create({
        data: {
          ownerId: user.id,
          type: "IMAGE",
          publicId: "dodoi/local/avatars/me",
          format: "jpg",
          width: 400,
          height: 400,
          bytes: 10_000,
        },
      });
      await db.profile.update({ where: { userId: user.id }, data: { avatarMediaId: avatar.id } });
      const post = await createPost();
      const custom = await createSkill("Pipe cleaner art", { origin: "CUSTOM" });
      await db.skill.update({ where: { id: custom.id }, data: { createdById: user.id } });
      await db.userSkill.create({
        data: { userId: user.id, skillId: custom.id, isInterest: true },
      });
      const save = await db.save.create({ data: { userId: user.id, postId: post.id } });
      await db.collection.create({
        data: {
          userId: user.id,
          name: "Ideas",
          nameNormalized: "ideas",
          items: { create: { saveId: save.id } },
        },
      });
      await db.postProgress.create({
        data: {
          userId: user.id,
          postId: post.id,
          checkedMaterialIds: [],
          completedStepPositions: [1],
        },
      });
      await db.feedSession.create({
        data: { userId: user.id, expiresAt: NOW, impressions: { create: { postId: post.id } } },
      });
      await db.feedFeedback.create({
        data: { userId: user.id, postId: post.id, type: "NOT_INTERESTED" },
      });
      await db.report.create({
        data: { reporterId: user.id, targetType: "SKILL", targetId: custom.id, reason: "SPAM" },
      });
      await db.auditLog.create({
        data: { actorId: user.id, action: "skill.hide", targetType: "skill", targetId: custom.id },
      });
      await db.authToken.create({
        data: {
          userId: user.id,
          type: "PASSWORD_RESET",
          tokenHash: "hash",
          expiresAt: NOW,
        },
      });
      await db.user.update({ where: { id: user.id }, data: { deletionRequestedAt: daysAgo(15) } });

      expect(await deleteAccountsDue({ now: NOW, provider })).toBe(1);

      expect(await db.user.count({ where: { id: user.id } })).toBe(0);
      for (const count of await Promise.all([
        db.profile.count(),
        db.userSkill.count(),
        db.save.count(),
        db.collection.count(),
        db.postProgress.count(),
        db.feedSession.count(),
        db.feedImpression.count(),
        db.feedFeedback.count(),
        db.report.count(),
        db.authToken.count(),
      ])) {
        expect(count).toBe(0);
      }
      expect(await db.skill.findUniqueOrThrow({ where: { id: custom.id } })).toMatchObject({
        createdById: null,
      });
      expect(await db.auditLog.findFirstOrThrow({ where: { action: "skill.hide" } })).toMatchObject(
        { actorId: null },
      );
      expect(provider.deleted).toEqual(["dodoi/local/avatars/me"]);
      expect(await db.mediaAsset.count({ where: { id: avatar.id } })).toBe(0);
      // The post the user saved is not theirs and stays.
      expect(await db.post.count({ where: { id: post.id } })).toBe(1);
    });

    it("deletes an invited creator's posts and their media, keeping media other posts use", async () => {
      const provider = createFakeMediaProvider();
      const creator = await createCreator({ deactivated: true });
      await db.user.update({
        where: { id: creator.id },
        data: { deletionRequestedAt: daysAgo(14) },
      });
      const own = await createPost({ authorId: creator.id, sourceType: "INVITED_CREATOR" });
      const ownMedia = await db.postMedia.findFirstOrThrow({ where: { postId: own.id } });
      const other = await createPost();
      await db.postMedia.create({
        data: { postId: other.id, mediaId: ownMedia.mediaId, position: 1 },
      });
      const second = await createPost({ authorId: creator.id, mediaCount: 2 });

      expect(await deleteAccountsDue({ now: NOW, provider })).toBe(1);

      expect(await db.post.count({ where: { id: { in: [own.id, second.id] } } })).toBe(0);
      expect(await db.post.count({ where: { id: other.id } })).toBe(1);
      expect(provider.deleted).toHaveLength(2);
      expect(await db.mediaAsset.count({ where: { id: ownMedia.mediaId } })).toBe(1);
      expect(
        await db.auditLog.count({
          where: { action: "post.delete", targetId: { in: [own.id, second.id] }, actorId: null },
        }),
      ).toBe(2);
    });

    it("keeps accounts still in their grace period, and cancelled ones", async () => {
      const waiting = await createMember();
      await db.user.update({
        where: { id: waiting.id },
        data: { deletionRequestedAt: daysAgo(13) },
      });
      const active = await createMember();

      expect(await deleteAccountsDue({ now: NOW, provider: createFakeMediaProvider() })).toBe(0);

      expect(await db.user.count({ where: { id: { in: [waiting.id, active.id] } } })).toBe(2);
    });

    it("deletes never-verified accounts older than 30 days, without a grace period", async () => {
      const old = await createUser({ emailVerified: null });
      const recent = await createUser({ emailVerified: null });
      const verified = await createUser();
      await db.user.update({ where: { id: old.id }, data: { createdAt: daysAgo(31) } });
      await db.user.update({ where: { id: recent.id }, data: { createdAt: daysAgo(29) } });
      await db.user.update({ where: { id: verified.id }, data: { createdAt: daysAgo(400) } });

      expect(await deleteAccountsDue({ now: NOW, provider: createFakeMediaProvider() })).toBe(1);

      expect(await db.user.findMany({ select: { id: true }, orderBy: { id: "asc" } })).toEqual(
        [{ id: recent.id }, { id: verified.id }].sort((a, b) => a.id.localeCompare(b.id)),
      );
    });

    it("is idempotent", async () => {
      const user = await createMember();
      await db.user.update({ where: { id: user.id }, data: { deletionRequestedAt: daysAgo(20) } });
      const provider = createFakeMediaProvider();

      expect(await deleteAccountsDue({ now: NOW, provider })).toBe(1);
      expect(await deleteAccountsDue({ now: NOW, provider })).toBe(0);
    });
  });
});
