import { existsSync } from "node:fs";

import { defineConfig } from "vitest/config";

// Read the same files `vite`'s loadEnv would, without importing `vite` (a transitive dependency
// pnpm does not expose, so the Vercel type check cannot resolve it). Later files do not override.
for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

// AI evaluation suite (TESTING_STRATEGY §7, P4-06). Run by hand with `pnpm test:ai-evals`: it calls
// the real Gemini API on the free tier with synthetic prompts only, so it is never part of
// `pnpm test`, never runs in CI and never touches real user data. The key and model come from
// .env.local.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: { "server-only": new URL("./tests/helpers/empty-module.ts", import.meta.url).pathname },
  },
  test: {
    env: process.env as Record<string, string>,
    environment: "node",
    include: ["tests/ai-evals/**/*.eval.ts"],
    // One request at a time: the free tier has tight per-minute limits.
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 150_000,
    hookTimeout: 30_000,
  },
});
