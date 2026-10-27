import { NextRequest } from "next/server";
import { encode } from "next-auth/jwt";
import { describe, expect, it } from "vitest";

import { config, proxy } from "./proxy";

// Local development uses the non-prefixed cookie (no `Secure`); Auth.js salts the JWT with its name.
const COOKIE_NAME = "authjs.session-token";
const SECRET = process.env.AUTH_SECRET ?? "";

async function sessionCookie(
  secret = SECRET,
  ageConfirmed = true,
  /** Undefined = a cookie issued before the onboarding claim existed. */
  onboardingComplete: boolean | undefined = true,
): Promise<string> {
  const token = await encode({
    token: {
      sub: "user_1",
      sv: 0,
      role: "USER",
      ev: true,
      ac: ageConfirmed,
      oc: onboardingComplete,
    },
    secret,
    salt: COOKIE_NAME,
  });
  return `${COOKIE_NAME}=${token}`;
}

function requestTo(path: string, cookie?: string): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    headers: cookie ? { cookie } : {},
  });
}

describe("proxy", () => {
  it("redirects signed-out visitors to /sign-in with the page as returnTo", async () => {
    const response = await proxy(requestTo("/saved/abc?sort=new"));

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/sign-in");
    expect(location.searchParams.get("returnTo")).toBe("/saved/abc?sort=new");
  });

  it("lets a request with a valid session cookie through", async () => {
    const response = await proxy(requestTo("/feed", await sessionCookie()));

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("sends a signed-in user without a confirmed age to /confirm-age", async () => {
    const response = await proxy(requestTo("/feed", await sessionCookie(SECRET, false)));

    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/confirm-age");
    expect(location.searchParams.get("returnTo")).toBe("/feed");
  });

  it("sends a signed-in user who has not finished onboarding to /onboarding", async () => {
    const cookie = await sessionCookie(SECRET, true, false);

    const fromAppPage = await proxy(requestTo("/saved", cookie));
    const fromWelcome = await proxy(requestTo("/", cookie));
    const onOnboarding = await proxy(requestTo("/onboarding", cookie));

    const location = new URL(fromAppPage.headers.get("location") ?? "");
    expect(location.pathname).toBe("/onboarding");
    expect(location.searchParams.get("returnTo")).toBe("/saved");
    expect(new URL(fromWelcome.headers.get("location") ?? "").pathname).toBe("/onboarding");
    expect(onOnboarding.headers.get("location")).toBeNull();
  });

  it("shows the welcome page to signed-out visitors and sends finished users to their feed", async () => {
    expect((await proxy(requestTo("/"))).headers.get("location")).toBeNull();
    const response = await proxy(requestTo("/", await sessionCookie()));
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/feed");
  });

  it("lets an older cookie without the onboarding claim through", async () => {
    const response = await proxy(requestTo("/feed", await sessionCookie(SECRET, true, undefined)));

    expect(response.headers.get("location")).toBeNull();
  });

  it("answers /admin with the 404 page unless the session is an admin's", async () => {
    const admin = await encode({
      token: { sub: "admin_1", sv: 0, role: "ADMIN", ev: true, ac: true, oc: true },
      secret: SECRET,
      salt: COOKIE_NAME,
    });

    const signedOut = await proxy(requestTo("/admin/posts"));
    const user = await proxy(requestTo("/admin/posts", await sessionCookie()));
    const adminResponse = await proxy(requestTo("/admin/posts", `${COOKIE_NAME}=${admin}`));

    for (const response of [signedOut, user]) {
      expect(response.headers.get("x-middleware-rewrite")).toContain("/_admin-not-found");
      expect(response.headers.get("location")).toBeNull();
    }
    expect(adminResponse.headers.get("x-middleware-next")).toBe("1");
  });

  it("sends admins to /admin instead of onboarding, finished or not", async () => {
    const admin = await encode({
      token: { sub: "admin_1", sv: 0, role: "ADMIN", ev: true, ac: true, oc: false },
      secret: SECRET,
      salt: COOKIE_NAME,
    });
    const cookie = `${COOKIE_NAME}=${admin}`;

    const fromWelcome = await proxy(requestTo("/", cookie));
    const fromOnboarding = await proxy(requestTo("/onboarding", cookie));
    const appPage = await proxy(requestTo("/saved", cookie));

    expect(new URL(fromWelcome.headers.get("location") ?? "").pathname).toBe("/admin");
    expect(new URL(fromOnboarding.headers.get("location") ?? "").pathname).toBe("/admin");
    expect(appPage.headers.get("location")).toBeNull();
  });

  it("sends a deactivated account to /account-deletion from every page", async () => {
    const deactivated = await encode({
      token: { sub: "user_1", sv: 0, role: "USER", ev: true, ac: true, oc: true, dl: true },
      secret: SECRET,
      salt: COOKIE_NAME,
    });
    const cookie = `${COOKIE_NAME}=${deactivated}`;

    for (const path of ["/", "/feed", "/settings/account"]) {
      const response = await proxy(requestTo(path, cookie));
      expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/account-deletion");
    }
    const deletionPage = await proxy(requestTo("/account-deletion", cookie));
    expect(deletionPage.headers.get("x-middleware-next")).toBe("1");
  });

  it("sends active accounts away from /account-deletion", async () => {
    const active = await proxy(requestTo("/account-deletion", await sessionCookie()));
    const signedOut = await proxy(requestTo("/account-deletion"));

    expect(new URL(active.headers.get("location") ?? "").pathname).toBe("/feed");
    expect(new URL(signedOut.headers.get("location") ?? "").pathname).toBe("/sign-in");
  });

  it("treats a tampered session cookie as signed out", async () => {
    const valid = await sessionCookie();
    const tampered = `${valid.slice(0, -6)}AAAAAA`;

    const response = await proxy(requestTo("/feed", tampered));

    expect(response.status).toBe(307);
  });

  it("treats a cookie encrypted with another secret as signed out", async () => {
    const forged = await sessionCookie("a-different-secret-that-is-32-chars-long");

    const response = await proxy(requestTo("/feed", forged));

    expect(response.status).toBe(307);
  });

  it("only runs on signed-in areas, never on public pages or the API", () => {
    expect(config.matcher).toContain("/feed/:path*");
    expect(config.matcher.some((pattern) => /^\/(p|api|sign-in)\b/.test(pattern))).toBe(false);
  });
});
