import "server-only";

import NextAuth, { AuthError } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

import { serverEnv } from "@/server/lib/env";
import { logger } from "@/server/lib/logger";

import { authAdapter } from "./adapter";
import { allowSignIn, authorizeCredentials, refreshSessionToken, toSession } from "./callbacks";
import { SESSION_MAX_AGE_SECONDS, usesSecureCookies } from "./cookies";

// Auth.js setup (ADR 0003, SECURITY_AND_PRIVACY §2): Google + email/password, JWT sessions
// (30 days, refreshed daily while in use), sign-in and error pages at /sign-in.

const SESSION_UPDATE_AGE_SECONDS = 24 * 60 * 60;

/** Failures caused by the user (wrong password, refused Google account), not by the system. */
const EXPECTED_AUTH_ERRORS = new Set(["CredentialsSignin", "AccessDenied", "OAuthCallbackError"]);

export const { handlers, auth } = NextAuth({
  secret: serverEnv.AUTH_SECRET,
  adapter: authAdapter,
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE_SECONDS,
    updateAge: SESSION_UPDATE_AGE_SECONDS,
  },
  useSecureCookies: usesSecureCookies(serverEnv.APP_ENV),
  pages: { signIn: "/sign-in", error: "/sign-in" },
  providers: [
    Google({
      clientId: serverEnv.AUTH_GOOGLE_ID,
      clientSecret: serverEnv.AUTH_GOOGLE_SECRET,
      // E2E runs point Google at a local mock provider (env.ts only allows it with APP_ENV=local).
      ...(serverEnv.AUTH_GOOGLE_ISSUER ? { issuer: serverEnv.AUTH_GOOGLE_ISSUER } : {}),
    }),
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: authorizeCredentials,
    }),
  ],
  callbacks: {
    signIn: allowSignIn,
    jwt: refreshSessionToken,
    session: toSession,
  },
  logger: {
    error(error) {
      const type = error instanceof AuthError ? error.type : error.name;
      if (EXPECTED_AUTH_ERRORS.has(type)) {
        logger.info("Sign-in refused", { type });
        return;
      }
      logger.error("Auth.js error", { type, error, cause: error.cause });
    },
    warn(code) {
      logger.warn("Auth.js warning", { code });
    },
    // Debug output can include tokens; it is never written.
    debug() {},
  },
});
