import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

import { usesSecureCookies } from "@/server/auth/cookies";
import { serverEnv } from "@/server/lib/env";

// Optimistic route protection (SECURITY_AND_PRIVACY §2.4, OD-29). Only the encrypted session
// cookie is checked here, never the database: every page and route handler still validates the
// session itself through `getActor()` (Data Access Layer). API routes answer 401 instead.
//
// Signed-in users are sent, in order, to: /confirm-age until Google sign-ups have entered their
// date of birth (AUTH-11), then /onboarding until onboarding is complete (F-05). Admins skip
// onboarding (PO decision, P1-17): the welcome page and /onboarding send them to /admin.
//
// /admin answers 404 to anyone whose session is not an admin's (SECURITY_AND_PRIVACY §3), so it
// never reveals itself with a sign-in redirect; the admin layout re-checks against the database.
// Not matched: post detail (/p/*) and auth pages are public.

const WELCOME_PATH = "/";
const ADMIN_PATH = "/admin";
/** Any path without a page: Next.js renders the standard 404 page with a 404 status. */
const NOT_FOUND_PATH = "/_admin-not-found";
const ONBOARDING_PATH = "/onboarding";
const FEED_PATH = "/feed";

function redirectTo(path: string, request: NextRequest): NextResponse {
  const destination = new URL(path, request.url);
  destination.searchParams.set("returnTo", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(destination);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = await getToken({
    req: request,
    secret: serverEnv.AUTH_SECRET,
    secureCookie: usesSecureCookies(serverEnv.APP_ENV),
  });

  if (pathname === ADMIN_PATH || pathname.startsWith(`${ADMIN_PATH}/`)) {
    return token?.role === "ADMIN"
      ? NextResponse.next()
      : NextResponse.rewrite(new URL(NOT_FOUND_PATH, request.url));
  }

  const isAdmin = token?.role === "ADMIN";
  const needsOnboarding = token?.oc === false && !isAdmin;

  // The welcome page is for signed-out visitors; signed-in users go on to setup or their feed.
  if (pathname === WELCOME_PATH) {
    if (token?.ac === false) return NextResponse.redirect(new URL("/confirm-age", request.url));
    if (isAdmin) return NextResponse.redirect(new URL(ADMIN_PATH, request.url));
    if (needsOnboarding) return NextResponse.redirect(new URL(ONBOARDING_PATH, request.url));
    // Signed-in users who are set up land on their feed (F-05, P1-22).
    if (token) return NextResponse.redirect(new URL(FEED_PATH, request.url));
    return NextResponse.next();
  }

  if (!token) return redirectTo("/sign-in", request);
  if (token.ac === false) return redirectTo("/confirm-age", request);
  const isOnboarding = pathname === ONBOARDING_PATH || pathname.startsWith(`${ONBOARDING_PATH}/`);
  if (isOnboarding && isAdmin) return NextResponse.redirect(new URL(ADMIN_PATH, request.url));
  if (needsOnboarding && !isOnboarding) return redirectTo(ONBOARDING_PATH, request);
  return NextResponse.next();
}

// Welcome plus the signed-in areas of SYSTEM_ARCHITECTURE §5. Matchers must be literals.
export const config = {
  matcher: [
    "/",
    "/feed/:path*",
    "/explore/:path*",
    "/search/:path*",
    "/s/:path*",
    "/t/:path*",
    "/saved/:path*",
    "/u/:path*",
    "/onboarding/:path*",
    "/profile",
    "/settings/:path*",
    "/admin/:path*",
  ],
};
