import type { MetadataRoute } from "next";

import { serverEnv } from "@/server/lib/env";

// robots.txt (P1-30). Only production is crawlable, and only what signed-out visitors can see
// (OD-29): the landing page and published posts. Everything else needs sign-in or is an API.
// Local and test environments also send `X-Robots-Tag: noindex` (src/lib/security-headers.ts).
export default function robots(): MetadataRoute.Robots {
  return robotsFor(serverEnv.APP_ENV);
}

export function robotsFor(appEnv: typeof serverEnv.APP_ENV): MetadataRoute.Robots {
  if (appEnv !== "production") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return { rules: { userAgent: "*", allow: ["/$", "/p/"], disallow: "/" } };
}
