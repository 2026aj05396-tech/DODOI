import type { MediaPurpose } from "@/lib/schemas/media";
import type { Actor } from "@/server/lib/actor";

// Content authorization (SECURITY_AND_PRIVACY §3). Admins upload and manage all media; signed-in
// users upload their own avatar (P1-12), post media and journal photos (P2-01). Covers stay
// admin-only.

const USER_PURPOSES: readonly MediaPurpose[] = [
  "avatar",
  "post",
  "entry",
  "ai",
  "help",
  "community",
];

export function canManageMedia(actor: Actor): boolean {
  return actor?.role === "ADMIN";
}

/** Who may sign and register an upload for `purpose`. */
export function canUploadMedia(actor: Actor, purpose: MediaPurpose): boolean {
  if (!actor) return false;
  return USER_PURPOSES.includes(purpose) || canManageMedia(actor);
}

/** Alt text and other edits: the uploader, or an admin. */
export function canEditMedia(actor: Actor, ownerId: string | null): boolean {
  if (!actor) return false;
  return canManageMedia(actor) || (ownerId !== null && ownerId === actor.id);
}
