import "server-only";

import { findCreatorRows, findUsernamesByIds, findUsersByUsernames } from "./repository";

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
