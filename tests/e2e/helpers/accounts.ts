import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

// Test data for E2E runs, written to the dodoi_test database the E2E server uses
// (playwright.config.ts) by a tsx script, because emails are not sent during E2E runs.

const SCRIPT = join(__dirname, "create-account.ts");
const PASSWORD = "e2e password long enough";

function run(args: string[]): string {
  return execFileSync("pnpm", ["exec", "tsx", SCRIPT, ...args], { encoding: "utf8" });
}

export function uniqueEmail(): string {
  return `e2e-${randomUUID()}@example.test`;
}

/** Creates an email/password user and returns the credentials. */
export function createPasswordAccount(
  options: { unverified?: boolean; ageUnconfirmed?: boolean; noPassword?: boolean } = {},
): { email: string; password: string } {
  const email = uniqueEmail();
  run([
    "account",
    email,
    PASSWORD,
    ...(options.unverified ? ["--unverified"] : []),
    ...(options.ageUnconfirmed ? ["--age-unconfirmed"] : []),
    ...(options.noPassword ? ["--no-password"] : []),
  ]);
  return { email, password: PASSWORD };
}

/** A valid email-verification token for an existing account (stands in for the emailed link). */
export function createVerificationToken(email: string): string {
  return run(["verification-token", email]).trim();
}

/** A valid password-reset token for an existing account (stands in for the emailed link). */
export function createResetToken(email: string): string {
  return run(["reset-token", email]).trim();
}

/** Clears rate-limit counters, since every E2E request comes from the same IP. */
export function resetRateLimits(): void {
  run(["reset-rate-limits"]);
}
