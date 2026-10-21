// Return URLs after sign-in must be relative same-origin paths (SECURITY_AND_PRIVACY §4), otherwise
// a link like /sign-in?returnTo=https://evil.example could send users to another site.

const DEFAULT_RETURN_PATH = "/";

/** Returns `candidate` if it is a safe in-app path, otherwise `fallback`. */
export function toSafeReturnPath(
  candidate: string | null | undefined,
  fallback = DEFAULT_RETURN_PATH,
): string {
  if (!candidate) return fallback;

  // Must be an absolute path on this site: "/x", but not "//host" or "/\host" (protocol-relative).
  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.startsWith("/\\")) {
    return fallback;
  }
  // Control characters (incl. tabs/newlines that browsers strip) can smuggle a host.
  if (/[\u0000-\u001f\u007f]/.test(candidate)) return fallback;

  // Resolve against a placeholder origin; anything that leaves it is not same-origin.
  const placeholderOrigin = "https://dodoi.invalid";
  let resolved: URL;
  try {
    resolved = new URL(candidate, placeholderOrigin);
  } catch {
    return fallback;
  }
  if (resolved.origin !== placeholderOrigin) return fallback;

  return `${resolved.pathname}${resolved.search}${resolved.hash}`;
}
