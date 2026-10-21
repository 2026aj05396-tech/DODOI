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
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
