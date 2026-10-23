import "server-only";

// Client IP for per-IP rate limits (SECURITY_AND_PRIVACY §6). Taken from the first
// `x-forwarded-for` entry, which only the hosting proxy can be trusted to set. Hosting is still
// OPEN (OD-01): when it is chosen, confirm the platform overwrites this header and adjust if not.

const UNKNOWN_IP = "unknown";

export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  return headers.get("x-real-ip")?.trim() || UNKNOWN_IP;
}
