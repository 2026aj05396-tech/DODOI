import { createHash, randomBytes } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import argon2 from "argon2";

import { PrismaClient } from "@/generated/prisma/client";

// Run with tsx by accounts.ts (Playwright loads test files as CommonJS, but the generated Prisma
// client is ESM-only). Usage:
//   tsx create-account.ts account <email> <password> [--unverified] [--age-unconfirmed]
//       [--no-password] [--onboarding-incomplete] [--admin]   (onboarding finished by default)
//   tsx create-account.ts verification-token <email>   (prints a fresh raw token)
//   tsx create-account.ts reset-token <email>          (prints a fresh raw token)
//   tsx create-account.ts reset-rate-limits

async function main(): Promise<void> {
  const [command, email, password, ...flags] = process.argv.slice(2);

  const databaseUrl =
    process.env.TEST_DATABASE_URL ??
    "postgresql://dodoi:dodoi@localhost:5433/dodoi_test?schema=public";
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

  try {
    // Every E2E request comes from the same IP; earlier runs must not use up its rate limits.
    await db.rateLimitBucket.deleteMany({});

    if (command === "reset-rate-limits") return;
    if (!email) throw new Error("Missing email");

    if (command === "account") {
      if (!password) throw new Error("Missing password");
      await db.user.create({
        data: {
          email,
          emailVerified: flags.includes("--unverified") ? null : new Date(),
          ageConfirmedAt: flags.includes("--age-unconfirmed") ? null : new Date(),
          onboardingCompletedAt: flags.includes("--onboarding-incomplete") ? null : new Date(),
          role: flags.includes("--admin") ? "ADMIN" : "USER",
          // --no-password: like an account created with Google sign-in.
          passwordHash: flags.includes("--no-password")
            ? null
            : await argon2.hash(password, { type: argon2.argon2id }),
        },
      });
    } else if (command === "verification-token" || command === "reset-token") {
      const user = await db.user.findUniqueOrThrow({ where: { email } });
      const rawToken = randomBytes(32).toString("base64url");
      await db.authToken.create({
        data: {
          userId: user.id,
          type: command === "reset-token" ? "PASSWORD_RESET" : "EMAIL_VERIFICATION",
          tokenHash: createHash("sha256").update(rawToken).digest("hex"),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
      process.stdout.write(rawToken);
    } else {
      throw new Error(`Unknown command: ${command}`);
    }
  } finally {
    await db.$disconnect();
  }
}

void main();
