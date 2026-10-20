import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Automated test runs (TESTING_STRATEGY §2). Integration tests use the separate dodoi_test
// database; CI overrides it with TEST_DATABASE_URL.
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://dodoi:dodoi@localhost:5433/dodoi_test?schema=public";

const testEnv = {
  APP_ENV: "local",
  DATABASE_URL: TEST_DATABASE_URL,
};

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    // `server-only` throws outside a React Server Components build; tests import server code directly.
    alias: { "server-only": new URL("./tests/helpers/empty-module.ts", import.meta.url).pathname },
  },
  test: {
    env: testEnv,
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "component",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
          setupFiles: ["./tests/helpers/setup-component-tests.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          globalSetup: ["./tests/helpers/integration-global-setup.ts"],
          // Integration tests share one database, so files run one at a time.
          fileParallelism: false,
        },
      },
    ],
  },
});
