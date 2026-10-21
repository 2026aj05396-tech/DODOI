import "server-only";

// CSRF defence for mutation route handlers (SECURITY_AND_PRIVACY §4): a state-changing request is
// accepted only if the browser says it came from this site. Browsers always send `Origin` on
// non-GET requests and modern ones also send `Sec-Fetch-Site`; a request with neither comes from a
// non-browser client, which cannot carry a victim's cookies, so it is allowed.

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function requestHost(headers: Headers): string | null {
  // Hosting proxies forward the public host here; the Host header may be an internal name.
  const forwardedHost = headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  return forwardedHost || headers.get("host");
}

export function isSameOriginRequest(request: Request): boolean {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return true;

  const origin = request.headers.get("origin");
  if (origin !== null) {
    if (origin === "null") return false;
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      return false;
    }
    return originHost === requestHost(request.headers);
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite !== null) {
    return fetchSite === "same-origin" || fetchSite === "none";
  }

  return true;
}
