import { defineConfig, devices } from "@playwright/test";

// End-to-end tests (TESTING_STRATEGY §5). Runs against a production build on port 3100 that uses
// the dodoi_test database, so it never touches local development data. A production build is used
// because Next.js allows only one `next dev` per project and matches what CI runs.
const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://dodoi:dodoi@localhost:5433/dodoi_test?schema=public";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 860 } },
    },
  ],
  webServer: {
    command: `pnpm exec next build && pnpm exec next start --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    // Overrides .env.local: the E2E server must use the test database, its own port and test-only
    // auth values (Google is never contacted).
    env: {
      APP_ENV: "local",
      DATABASE_URL: TEST_DATABASE_URL,
      AUTH_SECRET: "e2e-only-auth-secret-at-least-32-characters",
      AUTH_URL: BASE_URL,
      AUTH_GOOGLE_ID: "e2e-google-client-id",
      AUTH_GOOGLE_SECRET: "e2e-google-client-secret",
      // Empty key: no real email is sent during E2E runs.
      RESEND_API_KEY: "",
      EMAIL_FROM: "dodoi <e2e@example.test>",
    },
  },
});
