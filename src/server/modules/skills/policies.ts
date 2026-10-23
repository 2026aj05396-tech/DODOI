import type { Actor } from "@/server/lib/actor";

/** Custom interests are public as soon as they exist, so only verified users may add them (OD-08). */
export function canCreateCustomSkill(actor: Actor): boolean {
  return actor !== null && actor.isEmailVerified;
}
