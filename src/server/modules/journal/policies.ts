import type { AuthenticatedActor } from "@/server/lib/actor";

// Journal authorization (SECURITY_AND_PRIVACY §3, Phase 2 matrix): private projects are the
// owner's alone; public ones can be read by anyone signed in.

export function canSeeProject(
  actor: AuthenticatedActor,
  project: { ownerId: string; visibility: "PRIVATE" | "PUBLIC" },
): boolean {
  return project.ownerId === actor.id || project.visibility === "PUBLIC";
}
