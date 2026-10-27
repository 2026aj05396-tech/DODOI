import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

// Run with tsx by posts.ts (the generated Prisma client is ESM-only, like create-account.ts).
// Usage: tsx create-post.ts <json options>  → prints `{ "id", "relatedId" }`.
// Creates a Creative Commons tutorial (three photos and a video, materials, steps) on the
// predefined skill "crochet", plus one related post on the same skill, so the post page has every
// section. Options: { "status": "PUBLISHED" | "DRAFT" }.
// Feed mode: { "feed": { "count": 30 } } → creates a new skill (unique name, with a pitch) and that
// many published posts on it; prints `{ "skillSlug", "skillName", "ids" }`.

async function main(): Promise<void> {
  const options = JSON.parse(process.argv[2] ?? "{}") as {
    status?: "PUBLISHED" | "DRAFT";
    feed?: { count: number };
  };
  const databaseUrl =
    process.env.TEST_DATABASE_URL ??
    "postgresql://dodoi:dodoi@localhost:5433/dodoi_test?schema=public";
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

  try {
    if (options.feed) {
      const key = randomUUID().slice(0, 8);
      const name = `Feed craft ${key}`;
      const feedSkill = await db.skill.create({
        data: {
          name,
          normalizedName: name.toLowerCase(),
          slug: `feed-craft-${key}`,
          accent: "MINT",
          pitch: "A tiny craft made for testing the feed.",
        },
      });
      const ids: string[] = [];
      for (let index = 0; index < options.feed.count; index += 1) {
        const cover = await db.mediaAsset.create({
          data: {
            type: "IMAGE",
            publicId: `dodoi/local/posts/e2e-feed-${key}-${index}`,
            format: "jpg",
            width: 1200,
            height: index % 2 ? 1500 : 900,
            bytes: 100_000,
            altText: `Feed photo ${index}`,
          },
        });
        const post = await db.post.create({
          data: {
            type: "FINISHED",
            status: "PUBLISHED",
            publishedAt: new Date(),
            difficulty: "BEGINNER",
            estimatedMinutes: 30,
            title: `Feed post ${key} ${index}`,
            skills: { create: { skillId: feedSkill.id, isPrimary: true } },
            media: { create: { mediaId: cover.id, position: 0 } },
            attribution: {
              create: {
                sourceType: "TEAM_ORIGINAL",
                license: "Owned",
                attributionText: "Made by the dodoi team",
              },
            },
          },
        });
        ids.push(post.id);
      }
      process.stdout.write(JSON.stringify({ skillSlug: feedSkill.slug, skillName: name, ids }));
      return;
    }

    const skill = await db.skill.findUniqueOrThrow({ where: { slug: "crochet" } });
    const key = randomUUID().slice(0, 8);
    const media = async (index: number, type: "IMAGE" | "VIDEO" = "IMAGE") =>
      db.mediaAsset.create({
        data: {
          type,
          publicId: `dodoi/local/posts/e2e-${key}-${index}`,
          format: type === "VIDEO" ? "mp4" : "jpg",
          width: 1200,
          height: 900,
          bytes: 100_000,
          durationSec: type === "VIDEO" ? 20 : null,
          altText:
            type === "VIDEO" ? "Hands working the first round" : `Granny square photo ${index}`,
        },
      });
    const gallery = [await media(1), await media(2), await media(3), await media(4, "VIDEO")];
    const stepPhoto = await media(5);
    const publishedAt = options.status === "DRAFT" ? null : new Date();

    const post = await db.post.create({
      data: {
        type: "TUTORIAL",
        status: options.status ?? "PUBLISHED",
        publishedAt,
        title: `Granny square ${key}`,
        description: "Four rounds, one colour.",
        difficulty: "BEGINNER",
        estimatedMinutes: 45,
        skills: { create: { skillId: skill.id, isPrimary: true } },
        media: { create: gallery.map((item, position) => ({ mediaId: item.id, position })) },
        materials: { create: [{ position: 0, name: "Cotton yarn", note: "worsted weight" }] },
        steps: {
          create: [
            { position: 0, text: "Make a magic ring." },
            { position: 1, text: "Work the first round.", mediaId: stepPhoto.id },
          ],
        },
        attribution: {
          create: {
            sourceType: "CREATIVE_COMMONS",
            license: "CC BY 4.0",
            attributionText: "Photo by Asha on Wikimedia Commons",
            originalAuthor: "Asha",
            originalUrl: "https://commons.wikimedia.org/wiki/File:Granny_square.jpg",
          },
        },
      },
    });

    const relatedCover = await media(6);
    const related = await db.post.create({
      data: {
        type: "FIRST_ATTEMPT",
        status: "PUBLISHED",
        publishedAt: new Date(),
        title: `First amigurumi ${key}`,
        skills: { create: { skillId: skill.id, isPrimary: true } },
        media: { create: { mediaId: relatedCover.id, position: 0 } },
        attribution: {
          create: {
            sourceType: "TEAM_ORIGINAL",
            license: "Owned",
            attributionText: "Made by the dodoi team",
          },
        },
      },
    });
    process.stdout.write(JSON.stringify({ id: post.id, relatedId: related.id }));
  } finally {
    await db.$disconnect();
  }
}

void main();
