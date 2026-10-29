import { createHash, randomBytes } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import argon2 from "argon2";

import { PrismaClient } from "@/generated/prisma/client";

// Run with tsx by accounts.ts (Playwright loads test files as CommonJS, but the generated Prisma
// client is ESM-only). Usage:
//   tsx create-account.ts account <email> <password> [--unverified] [--age-unconfirmed]
//       [--no-password] [--onboarding-incomplete] [--admin] [--moderator] [--interests=slug,slug]
//       (onboarding finished by default; --interests adds those skills as interests)
//   tsx create-account.ts verification-token <email>   (prints a fresh raw token)
//   tsx create-account.ts reset-token <email>          (prints a fresh raw token)
//   tsx create-account.ts notifications <email>        (gives the account a post with a comment, three
//       likes and a new follower, as three makers' notifications; prints the post title)
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
      const interestSlugs =
        flags.find((flag) => flag.startsWith("--interests="))?.slice("--interests=".length) ?? "";
      const interests = interestSlugs
        ? await db.skill.findMany({ where: { slug: { in: interestSlugs.split(",") } } })
        : [];
      await db.user.create({
        data: {
          email,
          // Like a real sign-up, every account has a profile with a generated username.
          profile: {
            create: {
              username: `e2e-${randomBytes(4).toString("hex")}`,
              displayName: "E2E Maker",
            },
          },
          skills: {
            create: interests.map((skill) => ({ skillId: skill.id, isInterest: true })),
          },
          emailVerified: flags.includes("--unverified") ? null : new Date(),
          ageConfirmedAt: flags.includes("--age-unconfirmed") ? null : new Date(),
          onboardingCompletedAt: flags.includes("--onboarding-incomplete") ? null : new Date(),
          role: flags.includes("--admin")
            ? "ADMIN"
            : flags.includes("--moderator")
              ? "MODERATOR"
              : "USER",
          // --no-password: like an account created with Google sign-in.
          passwordHash: flags.includes("--no-password")
            ? null
            : await argon2.hash(password, { type: argon2.argon2id }),
        },
      });
    } else if (command === "notifications") {
      const owner = await db.user.findUniqueOrThrow({ where: { email } });
      const key = randomBytes(4).toString("hex");
      const skill = await db.skill.findUniqueOrThrow({ where: { slug: "crochet" } });
      const people = await Promise.all(
        ["Asha", "Ravi", "Zoya"].map((name) =>
          db.user.create({
            data: {
              email: `${name.toLowerCase()}-${key}@example.test`,
              emailVerified: new Date(),
              ageConfirmedAt: new Date(),
              profile: { create: { username: `${name.toLowerCase()}-${key}`, displayName: name } },
            },
          }),
        ),
      );
      const cover = await db.mediaAsset.create({
        data: {
          type: "IMAGE",
          publicId: `dodoi/local/posts/e2e-notify-${key}`,
          format: "jpg",
          width: 1200,
          height: 900,
          bytes: 100_000,
          altText: "Hoop",
        },
      });
      const title = `Cherry blossom hoop ${key}`;
      const post = await db.post.create({
        data: {
          authorId: owner.id,
          type: "FINISHED",
          status: "PUBLISHED",
          publishedAt: new Date(),
          title,
          skills: { create: { skillId: skill.id, isPrimary: true } },
          media: { create: { mediaId: cover.id, position: 0 } },
        },
      });
      const comment = await db.comment.create({
        data: { postId: post.id, authorId: people[0]?.id, body: "Lovely stitches!" },
      });
      await db.notification.createMany({
        data: [
          ...people.map((person) => ({
            recipientId: owner.id,
            type: "LIKE" as const,
            actorId: person.id,
            postId: post.id,
          })),
          {
            recipientId: owner.id,
            type: "COMMENT" as const,
            actorId: people[0]?.id,
            postId: post.id,
            commentId: comment.id,
          },
          { recipientId: owner.id, type: "FOLLOW" as const, actorId: people[1]?.id },
        ],
      });
      process.stdout.write(title);
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
