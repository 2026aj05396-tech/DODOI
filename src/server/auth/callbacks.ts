import "server-only";

import { CredentialsSignin, type Account, type Profile, type Session, type User } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { z } from "zod";

import { signInSchema } from "@/lib/schemas/auth";
import type { AuthenticatedActor } from "@/server/lib/actor";
import { getClientIp } from "@/server/lib/client-ip";
import { RateLimitError } from "@/server/lib/errors";
import {
  authenticateWithPassword,
  getSessionUser,
  promoteSeedAdminIfMatching,
  resolveGoogleSignIn,
  type SessionUser,
} from "@/server/modules/users";

// Auth.js callbacks (SECURITY_AND_PRIVACY §2). Kept apart from the NextAuth() call so integration
// tests can exercise them directly.

/** Shown on the sign-in page as `?code=rate_limited`. */
export class RateLimitedSignIn extends CredentialsSignin {
  override code = "rate_limited";
}

/** Shown as `?code=use_google`: the account has no password and signs in with Google. */
export class GoogleOnlySignIn extends CredentialsSignin {
  override code = "use_google";
}

/** Credentials provider `authorize`: returns `{ id }` on success, null for a wrong email/password. */
export async function authorizeCredentials(
  credentials: Partial<Record<string, unknown>>,
  request: Request,
): Promise<User | null> {
  const input = signInSchema.safeParse(credentials);
  if (!input.success) return null;
  try {
    const result = await authenticateWithPassword(input.data, getClientIp(request.headers));
    if (result.outcome === "no-password") throw new GoogleOnlySignIn();
    return result.outcome === "signed-in" ? { id: result.userId } : null;
  } catch (error) {
    if (error instanceof RateLimitError) throw new RateLimitedSignIn();
    throw error;
  }
}

/**
 * `signIn` callback. Google sign-ins are mapped to a dodoi user here, before Auth.js looks the
 * account up, so linking follows OD-09 instead of Auth.js's defaults. Returning false shows the
 * sign-in page with `?error=AccessDenied`.
 */
export async function allowSignIn({
  account,
  profile,
}: {
  account?: Account | null;
  profile?: Profile;
}): Promise<boolean> {
  // Credentials were already checked in `authorizeCredentials`.
  if (account?.provider !== "google") return account?.provider === "credentials";
  if (!profile?.email) return false;

  const result = await resolveGoogleSignIn({
    providerAccountId: account.providerAccountId,
    accountType: account.type,
    email: profile.email,
    emailVerified: profile.email_verified === true,
    name: profile.name ?? null,
  });
  return result !== null;
}

// What the encrypted session cookie holds: user id, session version, role, email-verified and
// age-confirmed flags. Role and flags are refreshed from the database on every request; the
// cookie is only a carrier (the proxy reads `ac` to send unconfirmed users to /confirm-age).
const sessionClaimsSchema = z.object({
  sub: z.string().min(1),
  sv: z.number().int(),
  role: z.enum(["USER", "ADMIN"]),
  ev: z.boolean(),
  ac: z.boolean(),
});

/** Session cookie claims for a user (also used to re-issue the cookie after a password change). */
export function toClaims(user: SessionUser) {
  return {
    sub: user.id,
    sv: user.sessionVersion,
    role: user.role,
    ev: user.isEmailVerified,
    ac: user.isAgeConfirmed,
  };
}

/**
 * `jwt` callback. On sign-in it builds the claims (promoting SEED_ADMIN_EMAIL first); afterwards it
 * re-checks the user on every request. Returning null ends the session: the user was deleted, or
 * `sessionVersion` moved on (password reset, linking that removed a password, sign-out everywhere).
 */
export async function refreshSessionToken({
  token,
  user,
}: {
  token: JWT;
  user?: User;
}): Promise<JWT | null> {
  if (user?.id) {
    await promoteSeedAdminIfMatching(user.id);
    const sessionUser = await getSessionUser(user.id);
    return sessionUser ? toClaims(sessionUser) : null;
  }

  const claims = sessionClaimsSchema.safeParse(token);
  if (!claims.success) return null;
  const sessionUser = await getSessionUser(claims.data.sub);
  if (!sessionUser || sessionUser.sessionVersion !== claims.data.sv) return null;
  return { ...token, ...toClaims(sessionUser) };
}

/** `session` callback: exposes only the actor, never email, name or tokens. */
export function toSession({ session, token }: { session: Session; token: JWT }): Session {
  const claims = sessionClaimsSchema.safeParse(token);
  if (!claims.success) return { expires: session.expires };
  const actor: AuthenticatedActor = {
    id: claims.data.sub,
    role: claims.data.role,
    isEmailVerified: claims.data.ev,
    isAgeConfirmed: claims.data.ac,
  };
  return { expires: session.expires, actor };
}
