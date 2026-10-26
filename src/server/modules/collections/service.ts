import "server-only";

import type { Actor } from "@/server/lib/actor";

import { findSavedPostIds } from "./repository";

// Saves and collections (roadmap P1-24 builds the rest of this module).

/** Which of `postIds` the actor has saved; always empty when signed out (OD-29). */
export async function getSavedPostIds(actor: Actor, postIds: string[]): Promise<Set<string>> {
  if (!actor || postIds.length === 0) return new Set();
  return new Set(await findSavedPostIds(actor.id, postIds));
}
