"use client";

import { useSyncExternalStore } from "react";

// Masonry columns (UI_UX_GUIDELINES §3): 2 below 1280px, 3 from 1280px. Null while rendering on
// the server, where the width is unknown; the feed shows its skeleton until the browser knows.

const WIDE = "(min-width: 1280px)";

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(WIDE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function useColumnCount(): 2 | 3 | null {
  return useSyncExternalStore(
    subscribe,
    () => (window.matchMedia(WIDE).matches ? 3 : 2),
    () => null,
  );
}
