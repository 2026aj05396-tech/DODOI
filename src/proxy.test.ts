import { NextRequest } from "next/server";
import { encode } from "next-auth/jwt";
import { describe, expect, it } from "vitest";

import { config, proxy } from "./proxy";

// Local development uses the non-prefixed cookie (no `Secure`); Auth.js salts the JWT with its name.
const COOKIE_NAME = "authjs.session-token";
const SECRET = process.env.AUTH_SECRET ?? "";

async function sessionCookie(secret = SECRET): Promise<string> {
  const token = await encode({
    token: { sub: "user_1", sv: 0, role: "USER", ev: true },
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
