import { withSerwist } from "@serwist/turbopack";
import type { NextConfig } from "next";

import { getSecurityHeaders, parseAppEnv } from "./src/lib/security-headers";

// Headers are resolved when the app is built, so each environment (local, test, production)
// is built with its own APP_ENV (SYSTEM_ARCHITECTURE §13). Next.js loads .env.local before this file.
const securityHeaders = getSecurityHeaders(parseAppEnv(process.env.APP_ENV), {
  isDevServer: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  // Don't advertise the framework in responses.
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // The service worker must never be held by a CDN or the browser cache, or a release would
      // not reach installed apps (Next.js PWA guide).
      {
        source: "/serwist/:path*",
        headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
      },
    ];
  },
};

// Serwist bundles the service worker with esbuild, which must stay out of the server bundle.
export default withSerwist(nextConfig);
