import { existsSync } from "node:fs";

import { defineConfig, env } from "prisma/config";

// Prisma 7 no longer loads env files itself. Next.js reads .env.local for the app, so the CLI reads it too.
if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx --conditions=react-server prisma/seed/index.ts",
  },
  datasource: {
    // Migrations need a direct connection; hosted databases behind a pooler (Neon, P1-35) give a
    // separate direct URL. The app itself always uses DATABASE_URL.
    url: process.env.DIRECT_DATABASE_URL || env("DATABASE_URL"),
  },
});
