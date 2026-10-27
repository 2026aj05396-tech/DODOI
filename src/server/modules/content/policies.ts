import type { MediaPurpose } from "@/lib/schemas/media";
import type { Actor } from "@/server/lib/actor";

// Content authorization (SECURITY_AND_PRIVACY §3). Admins upload and manage all media; signed-in
// users may upload their own avatar only (PO decision, P1-12).

export function canManageMedia(actor: Actor): boolean {
  return actor?.role === "ADMIN";
}

/** Who may sign and register an upload for `purpose`. */
export function canUploadMedia(actor: Actor, purpose: MediaPurpose): boolean {
  if (!actor) return false;
  return purpose === "avatar" || canManageMedia(actor);
}
