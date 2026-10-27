import type { SaveResult } from "@/lib/types/collections";

import { requestJson } from "./request";

// Saves (API_SPECIFICATION §6).

export function savePost(postId: string): Promise<SaveResult> {
  return requestJson<SaveResult>("PUT", `/api/saves/${postId}`);
}

export function unsavePost(postId: string): Promise<void> {
  return requestJson("DELETE", `/api/saves/${postId}`);
}
