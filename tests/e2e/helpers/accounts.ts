import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

// Test accounts for E2E runs, written to the dodoi_test database the E2E server uses
// (playwright.config.ts). Registration arrives in P1-05; until then accounts are created directly.

const SCRIPT = join(__dirname, "create-account.ts");

/** Creates a verified email/password user with a unique email and returns the credentials. */
export function createPasswordAccount(): { email: string; password: string } {
  const email = `e2e-${randomUUID()}@example.test`;
  const password = "e2e password long enough";
  execFileSync("pnpm", ["exec", "tsx", SCRIPT, email, password], { stdio: "inherit" });
  return { email, password };
}
