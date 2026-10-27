import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { ExperienceLevel, UpdateProfileInput } from "@/lib/schemas/me";
import type { ProfileSkill } from "@/lib/types/me";
import type { Actor, AuthenticatedActor } from "@/server/lib/actor";
import {
  ConflictError,
  NotFoundError,
  UnauthenticatedError,
  UnprocessableError,
  ValidationError,
  type FieldErrors,
} from "@/server/lib/errors";
import { containsOffensiveWords, getActiveSkillSummaries } from "@/server/modules/skills";

import {
  findOwnProfile,
  findProfileByUsername,
  findUserSkillRows,
  updateProfileRow,
} from "./repository";
import { isReservedUsername } from "./username";

// Profiles (PRF-01…08, OD-10, OD-11; API_SPECIFICATION §4). Own profile: read and edit, with the
// username rules (once per 30 days, reserved names, unique) and the offensive-word check on
// usernames and display names (PO decision, P1-13). Others: only what a profile may show.

const USERNAME_CHANGE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

function requireSignedIn(actor: Actor): AuthenticatedActor {
  if (!actor) throw new UnauthenticatedError();
  return actor;
}

export type OwnProfileRow = NonNullable<Awaited<ReturnType<typeof findOwnProfile>>>;

/** When the username may next change, or null if it may change now. */
export function usernameChangeAvailableAt(row: OwnProfileRow, now = new Date()): Date | null {
  if (!row.usernameChangedAt) return null;
  const next = new Date(row.usernameChangedAt.getTime() + USERNAME_CHANGE_DAYS * DAY_MS);
  return next > now ? next : null;
}

export async function getOwnProfile(actor: Actor): Promise<OwnProfileRow> {
  const user = requireSignedIn(actor);
  const row = await findOwnProfile(user.id);
  if (!row) throw new NotFoundError("We couldn't find your profile.");
  return row;
}

/**
 * PATCH /api/me/profile, after the caller has checked `avatarMediaId` belongs to the user
 * (the media lives in the content module). `409 USERNAME_TAKEN` · `422 USERNAME_CHANGE_TOO_SOON`.
 */
export async function updateOwnProfile(
  actor: Actor,
  input: UpdateProfileInput,
): Promise<OwnProfileRow> {
  const user = requireSignedIn(actor);
  const current = await getOwnProfile(user);
  const fields: FieldErrors = {};

  const changesUsername = input.username !== undefined && input.username !== current.username;
  if (changesUsername && input.username) {
    if (isReservedUsername(input.username)) {
      fields.username = "That username is reserved. Try another.";
    } else if (containsOffensiveWords(input.username)) {
      fields.username = "Please choose a different username.";
    }
  }
  if (input.displayName !== undefined && containsOffensiveWords(input.displayName)) {
    fields.displayName = "Please choose a different name.";
  }
  if (Object.keys(fields).length > 0) throw new ValidationError(undefined, { fields });

  if (changesUsername) {
    const availableAt = usernameChangeAvailableAt(current);
    if (availableAt) {
      const when = availableAt.toLocaleDateString("en-IN", { day: "numeric", month: "long" });
      throw new UnprocessableError(`You can change your username again on ${when}.`, {
        code: "USERNAME_CHANGE_TOO_SOON",
        fields: { username: `You can change your username again on ${when}.` },
      });
    }
  }

  try {
    return await updateProfileRow(user.id, {
      ...(changesUsername ? { username: input.username, usernameChangedAt: new Date() } : {}),
      ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
      ...(input.bio !== undefined ? { bio: input.bio } : {}),
      ...(input.avatarMediaId !== undefined ? { avatarMediaId: input.avatarMediaId } : {}),
      ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictError("That username is taken. Try another.", {
        code: "USERNAME_TAKEN",
        fields: { username: "That username is taken. Try another." },
      });
    }
    throw error;
  }
}

export type ProfileForView = {
  userId: string;
  isOwner: boolean;
  isPrivate: boolean;
  username: string;
  displayName: string;
  bio: string | null;
  avatarPublicId: string | null;
  visibility: "PUBLIC" | "PRIVATE";
};

/**
 * A profile by username for GET /api/profiles/{username}: 404 when unknown, deactivated or hidden
 * after a report (except for its owner). `isPrivate` is true when others may see only the basics.
 */
export async function getProfileForView(actor: Actor, username: string): Promise<ProfileForView> {
  const user = requireSignedIn(actor);
  const row = await findProfileByUsername(username.trim().toLowerCase());
  const isOwner = row?.userId === user.id;
  if (!row || (!isOwner && (row.isHidden || row.user.deletionRequestedAt))) {
    throw new NotFoundError("We couldn't find that profile.");
  }
  return {
    userId: row.userId,
    isOwner,
    isPrivate: !isOwner && row.visibility === "PRIVATE",
    username: row.username,
    displayName: row.displayName,
    bio: row.bio,
    avatarPublicId: row.avatar?.publicId ?? null,
    visibility: row.visibility,
  };
}

/** The profile's skill lists (PRF-02/03): interests, can help with, want to learn, with levels. */
export async function getProfileSkills(userId: string): Promise<{
  interests: ProfileSkill[];
  canHelp: ProfileSkill[];
  wantsToLearn: ProfileSkill[];
}> {
  const rows = await findUserSkillRows(userId);
  const skills = await getActiveSkillSummaries(rows.map((row) => row.skillId));
  const list = (flag: "isInterest" | "canHelp" | "wantsToLearn") =>
    rows.flatMap((row) => {
      const skill = skills.get(row.skillId);
      return row[flag] && skill ? [{ skill, level: row.level as ExperienceLevel | null }] : [];
    });
  return {
    interests: list("isInterest"),
    canHelp: list("canHelp"),
    wantsToLearn: list("wantsToLearn"),
  };
}
