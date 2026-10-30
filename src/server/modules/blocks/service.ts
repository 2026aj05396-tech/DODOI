import "server-only";

import { z } from "zod";

import { DEFAULT_PAGE_SIZE } from "@/lib/constants/pagination";
import type { BlockListQuery } from "@/lib/schemas/blocks";
import type { Paginated } from "@/lib/types/api";
import type { BlockedPerson } from "@/lib/types/blocks";
import type { Actor, AuthenticatedActor } from "@/server/lib/actor";
import { NotFoundError, UnauthenticatedError, UnprocessableError } from "@/server/lib/errors";
import { decodeCursor, encodeCursor } from "@/server/lib/pagination";
import { removeFollowsBetween } from "@/server/modules/follows";
import { removeNotificationsBetween } from "@/server/modules/notifications";
import { cancelSessionsBetween } from "@/server/modules/sessions";
import {
  addBlock,
  findBlockedByUser,
  getProfilesForModeration,
  getUserIdByUsername,
  removeBlock,
} from "@/server/modules/users";

// Blocking (P2-08; PRODUCT_REQUIREMENTS MOD-02, API_SPECIFICATION §9.1). The blocked person is
// never told. Everything that hides content between the two reads the block table through the
// users module; this module only adds and removes blocks and cleans up what they leave behind.

const cursorSchema = z.object({ createdAt: z.iso.datetime(), userId: z.string().min(1).max(40) });

function requireSignedIn(actor: Actor): AuthenticatedActor {
  if (!actor) throw new UnauthenticatedError();
  return actor;
}

function notFound(): NotFoundError {
  return new NotFoundError("We couldn't find that profile.");
}

/** PUT /api/blocks/{username}: idempotent; follows and notifications between the two go. */
export async function blockUser(actor: Actor, username: string): Promise<void> {
  const user = requireSignedIn(actor);
  const blockedId = await getUserIdByUsername(username);
  if (!blockedId) throw notFound();
  if (blockedId === user.id) {
    throw new UnprocessableError("You can't block yourself.", { code: "SELF_BLOCK" });
  }
  await addBlock(user.id, blockedId);
  await removeFollowsBetween(user.id, blockedId);
  await removeNotificationsBetween(user.id, blockedId);
  // Sessions still open between the two are cancelled (SES-02).
  await cancelSessionsBetween(user.id, blockedId);
}

/** DELETE /api/blocks/{username}: idempotent. */
export async function unblockUser(actor: Actor, username: string): Promise<void> {
  const user = requireSignedIn(actor);
  const blockedId = await getUserIdByUsername(username);
  if (!blockedId) throw notFound();
  await removeBlock(user.id, blockedId);
}

/** GET /api/me/blocks: the people you blocked, newest first. */
export async function listBlocks(
  actor: Actor,
  query: BlockListQuery,
): Promise<Paginated<BlockedPerson>> {
  const user = requireSignedIn(actor);
  const after = query.cursor
    ? (() => {
        const decoded = decodeCursor(query.cursor, cursorSchema);
        return { createdAt: new Date(decoded.createdAt), userId: decoded.userId };
      })()
    : null;
  const rows = await findBlockedByUser(user.id, after, DEFAULT_PAGE_SIZE + 1);
  const page = rows.slice(0, DEFAULT_PAGE_SIZE);
  const last = page.at(-1);
  // Hidden profiles stay in the list, so they can still be unblocked.
  const profiles = await getProfilesForModeration(page.map((row) => row.userId));
  return {
    items: page.flatMap((row) => {
      const profile = profiles.get(row.userId);
      return profile ? [{ username: profile.username, displayName: profile.displayName }] : [];
    }),
    nextCursor:
      rows.length > DEFAULT_PAGE_SIZE && last
        ? encodeCursor({ createdAt: last.createdAt.toISOString(), userId: last.userId })
        : null,
  };
}
