"use client";

import { useSyncExternalStore } from "react";

// Whether posts are saved, shared by every bookmark on screen (P1-25): saving from a card, adding
// to a collection from the picker (which saves too) and undoing an unsave all update the same
// value, so two cards for one post never disagree. Server data is the starting point.

const saved = new Map<string, boolean>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setSaved(postId: string, isSaved: boolean): void {
  saved.set(postId, isSaved);
  for (const listener of listeners) listener();
}

/** The post's saved state: the latest change on this page, else what the server said. */
export function useIsSaved(postId: string, initial: boolean): boolean {
  return useSyncExternalStore(
    subscribe,
    () => saved.get(postId) ?? initial,
    () => initial,
  );
}
