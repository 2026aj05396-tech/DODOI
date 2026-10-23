import "server-only";

import type { ServerEnv } from "@/server/lib/env";

/**
 * `Secure` (and `__Secure-` prefixed) session cookies everywhere except local http development
 * (SECURITY_AND_PRIVACY §2.4). Shared by the Auth.js config and the proxy so both use the same
 * cookie name.
 */
export function usesSecureCookies(appEnv: ServerEnv["APP_ENV"]): boolean {
  return appEnv !== "local";
}
