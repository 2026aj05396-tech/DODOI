import { PrismaPg } from "@prisma/adapter-pg";
import argon2 from "argon2";

import { PrismaClient } from "@/generated/prisma/client";

// Run with tsx by accounts.ts (Playwright loads test files as CommonJS, but the generated Prisma
// client is ESM-only). Usage: tsx create-account.ts <email> <password>

async function main(): Promise<void> {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) throw new Error("Usage: create-account.ts <email> <password>");

  const databaseUrl =
    process.env.TEST_DATABASE_URL ??
    "postgresql://dodoi:dodoi@localhost:5433/dodoi_test?schema=public";
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

  try {
    // Every E2E sign-in comes from the same IP; earlier runs must not use up its rate limit.
    await db.rateLimitBucket.deleteMany({ where: { key: { startsWith: "signin-" } } });
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    await db.user.create({ data: { email, emailVerified: new Date(), passwordHash } });
  } finally {
    await db.$disconnect();
  }
}

void main();
