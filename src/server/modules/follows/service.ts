import "server-only";

import { z } from "zod";

import { DEFAULT_PAGE_SIZE } from "@/lib/constants/pagination";
import type { FollowListQuery } from "@/lib/schemas/follows";
import type { Paginated } from "@/lib/types/api";
import type { FollowCounts, FollowListItem, FollowState } from "@/lib/types/follows";
import type { Actor, AuthenticatedActor } from "@/server/lib/actor";
import { ForbiddenError, NotFoundError, UnauthenticatedError } from "@/server/lib/errors";
import { decodeCursor, encodeCursor } from "@/server/lib/pagination";
import { enforceRateLimit, type RateLimitRule } from "@/server/lib/rate-limit";
import { avatarUrl } from "@/server/modules/content";
import { notify, withdrawNotification } from "@/server/modules/notifications";
import { getCreatorProfiles, getProfileForView, getUserIdByUsername } from "@/server/modules/users";

import {
  countFollowers,
  countFollowing,
  deleteFollow,
  deleteFollowsBetween,
  findFolloweeIds,
  findFollowerIds,
  findFollowersAmong,
  findFollowers,
  findFollowing,
  hasFollow,
  insertFollow,
} from "./repository";

// Follows (P2-06; PRODUCT_REQUIREMENTS FLW-01…04, API_SPECIFICATION §9.1). Only public profiles can
// be followed; counts and lists belong to the profile's owner alone (PP-4).

/** SECURITY_AND_PRIVACY §6: 200 follows (and unfollows) an hour per user. */
export const FOLLOW_RATE_LIMIT: RateLimitRule = {
  name: "follow",
  limit: 200,
  windowSeconds: 60 * 60,
};

const cursorSchema = z.object({ createdAt: z.iso.datetime(), userId: z.string().min(1).max(40) });

function requireSignedIn(actor: Actor): AuthenticatedActor {
  if (!actor) throw new UnauthenticatedError();
  return actor;
}

function profileNotFound(): NotFoundError {
  return new NotFoundError("We couldn't find that profile.");
}

/** The user id of a profile the actor may follow; 404 for your own, private, hidden or unknown. */
async function resolveFollowable(user: AuthenticatedActor, username: string): Promise<string> {
  const profile = await getProfileForView(user, username).catch((error: unknown) => {
    if (error instanceof NotFoundError) throw profileNotFound();
    throw error;
  });
  if (profile.isOwner || profile.isPrivate || profile.visibility !== "PUBLIC") {
    throw profileNotFound();
  }
  return profile.userId;
}

/** PUT /api/follows/{username}: idempotent; needs a verified email (OD-08). */
export async function followUser(actor: Actor, username: string): Promise<void> {
  const user = requireSignedIn(actor);
  if (!user.isEmailVerified) {
    throw new ForbiddenError("Verify your email to follow people.", {
      code: "EMAIL_NOT_VERIFIED",
    });
  }
  const followeeId = await resolveFollowable(user, username);
  await enforceRateLimit(FOLLOW_RATE_LIMIT, user.id);
  if (await insertFollow(user.id, followeeId)) {
    await notify({ type: "FOLLOW", recipientId: followeeId, actorId: user.id });
  }
}

/** DELETE /api/follows/{username}: idempotent. Works even if the profile went private since. */
export async function unfollowUser(actor: Actor, username: string): Promise<void> {
  const user = requireSignedIn(actor);
  const followeeId = await getUserIdByUsername(username);
  if (!followeeId) throw profileNotFound();
  await enforceRateLimit(FOLLOW_RATE_LIMIT, user.id);
  await deleteFollow(user.id, followeeId);
  await withdrawNotification({ type: "FOLLOW", recipientId: followeeId, actorId: user.id });
}

/** Whether the Follow button shows for this profile and what it says (creator row, profile). */
export async function getFollowState(actor: Actor, username: string): Promise<FollowState> {
  const user = requireSignedIn(actor);
  try {
    const followeeId = await resolveFollowable(user, username);
    return { canFollow: true, isFollowing: await hasFollow(user.id, followeeId) };
  } catch (error) {
    if (error instanceof NotFoundError) return { canFollow: false, isFollowing: false };
    throw error;
  }
}

/** Follows in both directions between two people go when one blocks the other (MOD-02). */
export async function removeFollowsBetween(a: string, b: string): Promise<void> {
  await deleteFollowsBetween(a, b);
}

/** The makers a user follows, for the feed's boost and "Following" filter (FLW-04). */
export async function getFollowedUserIds(userId: string): Promise<Set<string>> {
  return new Set(await findFolloweeIds(userId));
}

/** Up to `limit` people who follow the user, newest first (suggestions for who to message, MSG-06). */
export async function getFollowerUserIds(userId: string, limit: number): Promise<string[]> {
  return findFollowerIds(userId, limit);
}

/** Which of `userIds` follow `userId` (the "People I follow" message setting, MSG-02). */
export async function getFollowersAmong(userId: string, userIds: string[]): Promise<Set<string>> {
  return new Set(await findFollowersAmong(userId, userIds));
}

/** Follower and following counts: the owner's own only (FLW-03). */
export async function getOwnFollowCounts(actor: Actor): Promise<FollowCounts> {
  const user = requireSignedIn(actor);
  const [followers, following] = await Promise.all([
    countFollowers(user.id),
    countFollowing(user.id),
  ]);
  return { followers, following };
}

async function toPage(
  edges: { userId: string; createdAt: Date }[],
): Promise<Paginated<FollowListItem>> {
  const page = edges.slice(0, DEFAULT_PAGE_SIZE);
  const last = page.at(-1);
  const creators = await getCreatorProfiles(page.map((edge) => edge.userId));
  return {
    items: page.flatMap((edge) => {
      const creator = creators.get(edge.userId);
      if (!creator) return [];
      return [
        {
          username: creator.username,
          displayName: creator.displayName,
          avatarUrl: creator.avatarPublicId ? avatarUrl(creator.avatarPublicId) : null,
        },
      ];
    }),
    nextCursor:
      edges.length > DEFAULT_PAGE_SIZE && last
        ? encodeCursor({ createdAt: last.createdAt.toISOString(), userId: last.userId })
        : null,
  };
}

function toAfter(query: FollowListQuery) {
  if (!query.cursor) return null;
  const decoded = decodeCursor(query.cursor, cursorSchema);
  return { createdAt: new Date(decoded.createdAt), userId: decoded.userId };
}

/** GET /api/me/followers: the people who follow you, newest first (owner only, FLW-03). */
export async function listOwnFollowers(
  actor: Actor,
  query: FollowListQuery,
): Promise<Paginated<FollowListItem>> {
  const user = requireSignedIn(actor);
  return toPage(await findFollowers(user.id, toAfter(query), DEFAULT_PAGE_SIZE + 1));
}

/** GET /api/me/following: the people you follow, newest first (owner only, FLW-03). */
export async function listOwnFollowing(
  actor: Actor,
  query: FollowListQuery,
): Promise<Paginated<FollowListItem>> {
  const user = requireSignedIn(actor);
  return toPage(await findFollowing(user.id, toAfter(query), DEFAULT_PAGE_SIZE + 1));
}
