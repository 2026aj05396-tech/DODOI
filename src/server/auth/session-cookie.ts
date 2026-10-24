import "server-only";

import { encode } from "next-auth/jwt";

import { serverEnv } from "@/server/lib/env";
import { getSessionUser } from "@/server/modules/users";

import { toClaims } from "./callbacks";
import { SESSION_MAX_AGE_SECONDS, sessionCookieName, usesSecureCookies } from "./cookies";

export type SessionCookie = {
  name: string;
  value: string;
  options: {
    httpOnly: true;
    sameSite: "lax";
    path: "/";
    secure: boolean;
    maxAge: number;
  };
};

/**
 * A fresh session cookie for the user's current `sessionVersion`, encrypted the way Auth.js does
 * it. Used after a password change: the change signs out every session, and this keeps the device
 * that made the change signed in. Null if the user no longer exists.
 */
export async function issueSessionCookie(userId: string): Promise<SessionCookie | null> {
  const user = await getSessionUser(userId);
  if (!user) return null;
  const name = sessionCookieName(serverEnv.APP_ENV);
  const value = await encode({
    token: toClaims(user),
    secret: serverEnv.AUTH_SECRET,
    salt: name,
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return {
    name,
    value,
    options: {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: usesSecureCookies(serverEnv.APP_ENV),
      maxAge: SESSION_MAX_AGE_SECONDS,
    },
  };
}
