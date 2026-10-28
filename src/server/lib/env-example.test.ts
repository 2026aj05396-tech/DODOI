import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// .env.example is committed to git, so it must only ever contain placeholders. This guards against
// real credentials being typed into it by mistake (it happened twice during setup). Known key formats
// are matched anywhere; any other value is caught by the placeholder check.

const lines = readFileSync(join(process.cwd(), ".env.example"), "utf8").split("\n");

/** Values that may appear uncommented: the shared local-development defaults. */
const ALLOWED_ACTIVE_VALUES: Record<string, string> = {
  APP_ENV: "local",
  DATABASE_URL: "postgresql://dodoi:dodoi@localhost:5433/dodoi?schema=public",
};

/** Placeholder values that may appear in commented example lines. */
const ALLOWED_PLACEHOLDERS = new Set([
  "",
  "http://localhost:3000",
  "dodoi <onboarding@resend.dev>",
  "smtp.gmail.com",
]);

const SECRET_PATTERNS: [string, RegExp][] = [
  ["Resend API key", /\bre_[A-Za-z0-9_]{10,}/],
  ["Google OAuth client ID", /\.apps\.googleusercontent\.com/],
  ["Google OAuth client secret", /\bGOCSPX-/],
  ["Cloudinary URL with credentials", /cloudinary:\/\/\d+:/],
];

function parseAssignment(line: string): { name: string; value: string; commented: boolean } | null {
  const match = /^\s*(#\s*)?([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
  if (!match) return null;
  const value = (match[3] ?? "").replace(/^"(.*)"$/, "$1");
  return { commented: Boolean(match[1]), name: match[2] ?? "", value };
}

describe(".env.example", () => {
  it("contains nothing that looks like a real secret", () => {
    const findings = lines.flatMap((line, index) =>
      SECRET_PATTERNS.filter(([, pattern]) =>
        pattern.test(line.replace(/postgresql:\/\/\S+/, "")),
      ).map(([label]) => `line ${index + 1}: ${label}`),
    );

    expect(findings).toEqual([]);
  });

  it("only sets the shared local defaults; every other variable stays a commented placeholder", () => {
    const problems = lines.flatMap((line, index) => {
      const assignment = parseAssignment(line);
      if (!assignment) return [];
      const { name, value, commented } = assignment;
      if (!commented) {
        return ALLOWED_ACTIVE_VALUES[name] === value
          ? []
          : [`line ${index + 1}: ${name} must not be set here`];
      }
      return ALLOWED_PLACEHOLDERS.has(value)
        ? []
        : [`line ${index + 1}: ${name} has a non-placeholder value`];
    });

    expect(problems).toEqual([]);
  });
});
