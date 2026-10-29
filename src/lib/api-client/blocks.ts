import type { Paginated } from "@/lib/types/api";
import type { BlockedPerson } from "@/lib/types/blocks";

import { requestJson } from "./request";

// Blocking (API_SPECIFICATION §9.1, P2-08).

export function blockUser(username: string): Promise<void> {
  return requestJson("PUT", `/api/blocks/${encodeURIComponent(username)}`);
}

export function unblockUser(username: string): Promise<void> {
  return requestJson("DELETE", `/api/blocks/${encodeURIComponent(username)}`);
}

export function listBlocks(cursor: string | null): Promise<Paginated<BlockedPerson>> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return requestJson<Paginated<BlockedPerson>>("GET", `/api/me/blocks${query}`);
}
