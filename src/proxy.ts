import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

import { usesSecureCookies } from "@/server/auth/cookies";
import { serverEnv } from "@/server/lib/env";

// Optimistic route protection (SECURITY_AND_PRIVACY §2.4, OD-29). Signed-out visitors to a
// signed-in page are sent to /sign-in with a return path. Only the encrypted session cookie is
// checked here, never the database: every page and route handler still validates the session
// itself through `getActor()` (Data Access Layer). API routes answer 401 instead of redirecting.
//
// Not matched: landing, post detail (/p/*) and auth pages are public; /admin pages answer 404 to
// anyone who is not an admin (SECURITY_AND_PRIVACY §3), so they never reveal a sign-in redirect.

export async function proxy(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: serverEnv.AUTH_SECRET,
    secureCookie: usesSecureCookies(serverEnv.APP_ENV),
  });
  if (token) return NextResponse.next();

  const signInUrl = new URL("/sign-in", request.url);
  signInUrl.searchParams.set("returnTo", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(signInUrl);
}

// Signed-in areas of SYSTEM_ARCHITECTURE §5. Matchers must be literals (read at build time).
export const config = {
  matcher: [
    "/feed/:path*",
    "/explore/:path*",
    "/search/:path*",
    "/s/:path*",
    "/t/:path*",
    "/saved/:path*",
    "/u/:path*",
    "/onboarding/:path*",
    "/settings/:path*",
  ],
};
