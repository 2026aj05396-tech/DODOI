// Security headers sent on every response (SECURITY_AND_PRIVACY §4, SYSTEM_ARCHITECTURE §13).
// Pure module: next.config.ts imports it at build/start time, so it must not import server-only code.

export type AppEnv = "local" | "test" | "production";

export type HeaderEntry = { key: string; value: string };

// Browser features dodoi does not use are switched off. Revisit when a feature needs one
// (e.g. camera for in-app capture).
const PERMISSIONS_POLICY = [
  "accelerometer=()",
  "autoplay=()",
  "camera=()",
  "display-capture=()",
  "geolocation=()",
  "gyroscope=()",
  "magnetometer=()",
  "microphone=()",
  "payment=()",
  "usb=()",
].join(", ");

const TWO_YEARS_IN_SECONDS = 63_072_000;

const CLOUDINARY_DELIVERY = "https://res.cloudinary.com";
const CLOUDINARY_UPLOAD = "https://api.cloudinary.com";
const GOOGLE_SIGN_IN = "https://accounts.google.com";

type SecurityHeaderOptions = {
  /** `next dev` needs eval and a WebSocket for hot reload; never true for builds. */
  isDevServer?: boolean;
};

/**
 * Static Content Security Policy without nonces (OD-35, option A) so pages stay statically
 * rendered and cacheable. 'unsafe-inline' scripts are required by Next.js without nonces; React's
 * escaping and the ban on raw HTML (CODE_QUALITY §14.2) cover inline-script injection. Switch to a
 * nonce-based policy if user-written HTML is ever rendered.
 */
export function buildContentSecurityPolicy(
  appEnv: AppEnv,
  { isDevServer = false }: SecurityHeaderOptions = {},
): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(isDevServer ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", CLOUDINARY_DELIVERY],
    "media-src": ["'self'", "blob:", CLOUDINARY_DELIVERY],
    "font-src": ["'self'"],
    "connect-src": ["'self'", CLOUDINARY_UPLOAD, ...(isDevServer ? ["ws:"] : [])],
    "form-action": ["'self'", GOOGLE_SIGN_IN],
    "frame-ancestors": ["'none'"],
    "base-uri": ["'self'"],
    "object-src": ["'none'"],
  };

  const policy = Object.entries(directives).map(
    ([directive, sources]) => `${directive} ${sources.join(" ")}`,
  );
  // Local development runs on plain http, so upgrading would break it.
  if (appEnv !== "local") policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}

export function getSecurityHeaders(
  appEnv: AppEnv,
  options: SecurityHeaderOptions = {},
): HeaderEntry[] {
  const headers: HeaderEntry[] = [
    { key: "Content-Security-Policy", value: buildContentSecurityPolicy(appEnv, options) },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: PERMISSIONS_POLICY },
  ];

  if (appEnv === "production") {
    headers.push({
      key: "Strict-Transport-Security",
      value: `max-age=${TWO_YEARS_IN_SECONDS}; includeSubDomains`,
    });
  } else {
    // Local and hosted test environments must never be indexed by search engines.
    headers.push({ key: "X-Robots-Tag", value: "noindex, nofollow" });
  }

  return headers;
}

export function parseAppEnv(value: string | undefined): AppEnv {
  if (value === "local" || value === "test" || value === "production") return value;
  throw new Error(`APP_ENV must be local, test or production (received "${value ?? ""}").`);
}
