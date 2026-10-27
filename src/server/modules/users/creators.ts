import "server-only";

import {
  findCreatorRows,
  findDisplayName,
  findUsernamesByIds,
  findUsersByUsernames,
} from "./repository";

export type CreatorProfile = {
  username: string;
  displayName: string;
  /** Storage id of the avatar; the content module turns it into a delivery URL. */
  avatarPublicId: string | null;
};

/**
 * Creator rows for posts, keyed by user id. Hidden (after a report) and deactivated profiles are
 * left out, so posts show no creator rather than send people to a hidden profile (PO, P1-15).
 */
export async function getCreatorProfiles(userIds: string[]): Promise<Map<string, CreatorProfile>> {
  if (userIds.length === 0) return new Map();
  const rows = await findCreatorRows(userIds);
  const creators = new Map<string, CreatorProfile>();
  for (const row of rows) {
    if (!row.profile || row.profile.isHidden || row.deletionRequestedAt) continue;
    creators.set(row.id, {
      username: row.profile.username,
      displayName: row.profile.displayName,
      avatarPublicId: row.profile.avatar?.publicId ?? null,
    });
  }
  return creators;
}

/**
 * The owner shown on a public collection, or null when others may not see their public content:
 * private profile (OD-10), hidden after a report, or deactivated.
 */
export async function getPublicProfile(
  userId: string,
): Promise<{ username: string; displayName: string } | null> {
  const [row] = await findCreatorRows([userId]);
  if (!row?.profile || row.deletionRequestedAt) return null;
  if (row.profile.isHidden || row.profile.visibility !== "PUBLIC") return null;
  return { username: row.profile.username, displayName: row.profile.displayName };
}

/** User id for a username (usernames are stored lowercase), or null. For the admin post editor. */
export async function getUserIdByUsername(username: string): Promise<string | null> {
  const [row] = await findUsersByUsernames([username.trim().toLowerCase()]);
  return row?.userId ?? null;
}

/** Usernames keyed by user id, whatever the profile's visibility (admin views). */
export async function getUsernames(userIds: string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const rows = await findUsernamesByIds(userIds);
  return new Map(rows.map((row) => [row.userId, row.username]));
}

/** The user's own display name (feed greeting, P1-22); null without a profile. */
export async function getDisplayName(userId: string): Promise<string | null> {
  return findDisplayName(userId);
}
