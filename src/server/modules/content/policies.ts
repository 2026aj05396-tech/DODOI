import type { Actor } from "@/server/lib/actor";

// Content authorization (SECURITY_AND_PRIVACY §3). In Phase 1 only admins upload and manage media;
// users get avatar uploads with P1-12 (PROPOSED in API_SPECIFICATION §7).

export function canManageMedia(actor: Actor): boolean {
  return actor?.role === "ADMIN";
}
