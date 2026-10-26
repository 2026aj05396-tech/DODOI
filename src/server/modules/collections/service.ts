import "server-only";

import type { Actor } from "@/server/lib/actor";

import { findSavedPostIds, findSavedSkillIdsSince } from "./repository";

// Saves and collections (roadmap P1-24 builds the rest of this module).

/** Which of `postIds` the actor has saved; always empty when signed out (OD-29). */
export async function getSavedPostIds(actor: Actor, postIds: string[]): Promise<Set<string>> {
  if (!actor || postIds.length === 0) return new Set();
  return new Set(await findSavedPostIds(actor.id, postIds));
}

/** Skills of the posts the user saved since `since`, for the feed's save affinity (P1-21). */
export async function getRecentlySavedSkillIds(userId: string, since: Date): Promise<Set<string>> {
  return new Set(await findSavedSkillIdsSince(userId, since));
}
