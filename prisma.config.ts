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
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
