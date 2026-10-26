import { NotFoundError } from "./errors";

// The authenticated user performing an action, passed explicitly to every service function
// (CODE_QUALITY §4.3). `null` means signed out. Built from the Auth.js session (src/server/auth).

export type Role = "USER" | "ADMIN";

export type AuthenticatedActor = {
  id: string;
  role: Role;
  /** Public actions (custom interests, public collections) need a verified email (OD-08). */
  isEmailVerified: boolean;
  /**
   * False only for Google sign-ups that have not entered their date of birth yet; until then every
   * other API call answers 403 AGE_CHECK_REQUIRED (API_SPECIFICATION §3).
   */
  isAgeConfirmed: boolean;
};

export type Actor = AuthenticatedActor | null;

/**
 * Admin-only features answer 404 to everyone else, signed in or not, so they never reveal that
 * they exist (SECURITY_AND_PRIVACY §3).
 */
export function requireAdmin(actor: Actor): AuthenticatedActor {
  if (actor?.role !== "ADMIN") throw new NotFoundError();
  return actor;
}
