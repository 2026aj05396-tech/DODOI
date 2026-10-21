import { describe, expect, it } from "vitest";

import {
  buildContentSecurityPolicy,
  getSecurityHeaders,
  parseAppEnv,
} from "@/lib/security-headers";

function asRecord(appEnv: Parameters<typeof getSecurityHeaders>[0]): Record<string, string> {
  return Object.fromEntries(getSecurityHeaders(appEnv).map(({ key, value }) => [key, value]));
}

describe("getSecurityHeaders", () => {
  it("sends the baseline protections in every environment", () => {
    for (const appEnv of ["local", "test", "production"] as const) {
      const headers = asRecord(appEnv);
      expect(headers["X-Frame-Options"]).toBe("DENY");
      expect(headers["X-Content-Type-Options"]).toBe("nosniff");
      expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
      expect(headers["Permissions-Policy"]).toContain("camera=()");
    }
  });

  it("enables HSTS only in production", () => {
    expect(asRecord("production")["Strict-Transport-Security"]).toContain("max-age=63072000");
    expect(asRecord("test")["Strict-Transport-Security"]).toBeUndefined();
    expect(asRecord("local")["Strict-Transport-Security"]).toBeUndefined();
  });

  it("keeps local and test environments out of search engines", () => {
    expect(asRecord("local")["X-Robots-Tag"]).toBe("noindex, nofollow");
    expect(asRecord("test")["X-Robots-Tag"]).toBe("noindex, nofollow");
    expect(asRecord("production")["X-Robots-Tag"]).toBeUndefined();
  });
});

describe("buildContentSecurityPolicy", () => {
  function directives(policy: string): Record<string, string> {
    return Object.fromEntries(
      policy.split("; ").map((part) => {
        const [name = "", ...sources] = part.split(" ");
        return [name, sources.join(" ")];
      }),
    );
  }

  it("allows only dodoi, Cloudinary media and Google sign-in redirects", () => {
    const policy = directives(buildContentSecurityPolicy("production"));

    expect(policy["default-src"]).toBe("'self'");
    expect(policy["img-src"]).toContain("https://res.cloudinary.com");
    expect(policy["connect-src"]).toBe("'self' https://api.cloudinary.com");
    expect(policy["form-action"]).toBe("'self' https://accounts.google.com");
    expect(policy["frame-ancestors"]).toBe("'none'");
    expect(policy["object-src"]).toBe("'none'");
    expect(policy["base-uri"]).toBe("'self'");
  });

  it("never allows eval or WebSockets outside the dev server", () => {
    const built = buildContentSecurityPolicy("local");
    expect(built).not.toContain("unsafe-eval");
    expect(built).not.toContain("ws:");

    const devServer = buildContentSecurityPolicy("local", { isDevServer: true });
    expect(devServer).toContain("'unsafe-eval'");
    expect(devServer).toContain("ws:");
  });

  it("upgrades insecure requests on hosted environments only", () => {
    expect(buildContentSecurityPolicy("production")).toContain("upgrade-insecure-requests");
    expect(buildContentSecurityPolicy("test")).toContain("upgrade-insecure-requests");
    expect(buildContentSecurityPolicy("local")).not.toContain("upgrade-insecure-requests");
  });
});

describe("parseAppEnv", () => {
  it("accepts known environments and rejects anything else", () => {
    expect(parseAppEnv("test")).toBe("test");
    expect(() => parseAppEnv("staging")).toThrow(/APP_ENV/);
    expect(() => parseAppEnv(undefined)).toThrow(/APP_ENV/);
  });
});
