import { execFileSync } from "node:child_process";

// Runs once before the E2E suite: loads the predefined skills into the E2E database (onboarding
// needs them). Integration tests empty that database, so this cannot rely on earlier runs.
// The seed is idempotent.
export default function globalSetup(): void {
  const databaseUrl =
    process.env.TEST_DATABASE_URL ??
    "postgresql://dodoi:dodoi@localhost:5433/dodoi_test?schema=public";
  execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
  execFileSync("pnpm", ["exec", "prisma", "db", "seed"], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: databaseUrl, APP_ENV: "local" },
  });
}
