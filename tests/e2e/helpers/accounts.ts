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
  options: {
    unverified?: boolean;
    ageUnconfirmed?: boolean;
    noPassword?: boolean;
    onboardingIncomplete?: boolean;
    admin?: boolean;
    moderator?: boolean;
    /** Skill slugs added as interests. */
    interests?: string[];
    /** Skill slugs added as "can help with" (HLP-03). */
    canHelp?: string[];
  } = {},
): { email: string; password: string } {
  const email = uniqueEmail();
  run([
    "account",
    email,
    PASSWORD,
    ...(options.unverified ? ["--unverified"] : []),
    ...(options.ageUnconfirmed ? ["--age-unconfirmed"] : []),
    ...(options.noPassword ? ["--no-password"] : []),
    ...(options.onboardingIncomplete ? ["--onboarding-incomplete"] : []),
    ...(options.admin ? ["--admin"] : []),
    ...(options.moderator ? ["--moderator"] : []),
    ...(options.interests ? [`--interests=${options.interests.join(",")}`] : []),
    ...(options.canHelp ? [`--can-help=${options.canHelp.join(",")}`] : []),
  ]);
  return { email, password: PASSWORD };
}

/**
 * Gives an existing account a post of theirs with a comment and three likes from other makers, and
 * a new follower, as notifications. Returns the post's title.
 */
export function createNotifications(email: string): string {
  return run(["notifications", email]).trim();
}

/** Gives an existing account one saved companion chat; returns its id. */
export function createAIConversation(email: string): string {
  return run(["ai-conversation", email]).trim();
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

/** A published (or draft) Creative Commons tutorial with every section, plus one related post. */
export function createPost(options: { status?: "PUBLISHED" | "DRAFT"; creator?: boolean } = {}): {
  id: string;
  relatedId: string;
  creatorUsername?: string;
  creatorName?: string;
} {
  const output = execFileSync(
    "pnpm",
    ["exec", "tsx", join(__dirname, "create-post.ts"), JSON.stringify(options)],
    { encoding: "utf8" },
  );
  return JSON.parse(output) as {
    id: string;
    relatedId: string;
    creatorUsername?: string;
    creatorName?: string;
  };
}

/** A new skill (unique name, with a pitch) and `count` published posts on it, for feed tests. */
export function createFeedPosts(count: number): {
  skillSlug: string;
  skillName: string;
  ids: string[];
} {
  const output = execFileSync(
    "pnpm",
    ["exec", "tsx", join(__dirname, "create-post.ts"), JSON.stringify({ feed: { count } })],
    { encoding: "utf8" },
  );
  return JSON.parse(output) as { skillSlug: string; skillName: string; ids: string[] };
}
