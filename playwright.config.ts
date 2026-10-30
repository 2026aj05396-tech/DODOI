import { defineConfig, devices } from "@playwright/test";

// End-to-end tests (TESTING_STRATEGY §5). Runs against a production build on port 3100 that uses
// the dodoi_test database, so it never touches local development data. A production build is used
// because Next.js allows only one `next dev` per project and matches what CI runs.
const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;
const MOCK_GOOGLE_ISSUER = "http://localhost:3199";
const MOCK_CLOUDINARY_API = "http://localhost:3198/v1_1";
// WebKit (Safari) and Firefox run a smoke subset (tests tagged @smoke, TESTING_STRATEGY §5) in CI,
// or locally with `pnpm test:e2e:browsers`. Plain local runs stay Chromium-only: WebKit needs
// system libraries (`sudo pnpm exec playwright install-deps webkit`).
const ALL_BROWSERS = Boolean(process.env.CI) || process.env.E2E_BROWSERS === "all";
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://dodoi:dodoi@localhost:5433/dodoi_test?schema=public";

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  // Sign-in flows chain several redirects (e.g. Google → callback → /confirm-age → /feed); with
  // every worker on one server, the default 5 s ran out now and then on whichever test was busiest.
  expect: { timeout: 10_000 },
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
    ...(ALL_BROWSERS
      ? [
          { name: "webkit", use: { ...devices["iPhone 15"] }, grep: /@smoke/ },
          { name: "firefox", use: { ...devices["Desktop Firefox"] }, grep: /@smoke/ },
        ]
      : []),
  ],
  webServer: [
    {
      // Stand-in for Google sign-in (E2E-02); see tests/e2e/helpers/mock-google.ts.
      command: "pnpm exec tsx tests/e2e/helpers/mock-google.ts",
      url: `${MOCK_GOOGLE_ISSUER}/.well-known/openid-configuration`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      // Stand-in for Cloudinary's Admin API (E2E-12); see tests/e2e/helpers/mock-cloudinary.ts.
      command: "pnpm exec tsx tests/e2e/helpers/mock-cloudinary.ts",
      url: `${MOCK_CLOUDINARY_API}/e2e-cloud/resources/image/upload/ready`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: `pnpm exec next build && pnpm exec next start --port ${PORT}`,
      url: BASE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
      // Overrides .env.local: the E2E server must use the test database, its own port, test-only
      // auth values and the mock Google provider.
      env: {
        APP_ENV: "local",
        DATABASE_URL: TEST_DATABASE_URL,
        AUTH_SECRET: "e2e-only-auth-secret-at-least-32-characters",
        AUTH_URL: BASE_URL,
        AUTH_GOOGLE_ID: "e2e-google-client-id",
        AUTH_GOOGLE_SECRET: "e2e-google-client-secret",
        AUTH_GOOGLE_ISSUER: MOCK_GOOGLE_ISSUER,
        // Empty key: no real email is sent during E2E runs.
        RESEND_API_KEY: "",
        EMAIL_FROM: "dodoi <e2e@example.test>",
        // Fake values: uploads are answered by the tests, the Admin API by the mock above.
        CLOUDINARY_CLOUD_NAME: "e2e-cloud",
        CLOUDINARY_API_KEY: "e2e-key",
        CLOUDINARY_API_SECRET: "e2e-secret",
        CLOUDINARY_API_BASE: MOCK_CLOUDINARY_API,
        // The companion is off, so no run reaches Google whatever .env.local holds; the free tier
        // shows its test-version notice (P4-02).
        AI_ENABLED: "false",
        AI_TIER: "free",
      },
    },
  ],
});
