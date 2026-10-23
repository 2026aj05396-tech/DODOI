import type { AuthenticatedActor } from "@/server/lib/actor";

// The session carries only the actor (no name, email or picture), built in the `session` callback.
declare module "next-auth" {
  interface Session {
    actor?: AuthenticatedActor;
  }
}
