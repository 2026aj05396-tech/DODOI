import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/server/db/client";
import { importSeedContent } from "@/server/modules/content";

import { resetDatabase } from "../helpers/database";
import { createCreator, createSkill } from "../helpers/factories";
import { createFakeMediaProvider } from "../helpers/fake-media";

// Seed content importer (roadmap P1-18, ADM-01…03, NFR-06): idempotent by seedKey, the file is the
// source of truth, attribution and licences checked on every import.

let folder: string;
let provider: ReturnType<typeof createFakeMediaProvider>;

async function writeMedia(name: string, content = name): Promise<void> {
  await writeFile(path.join(folder, "media", name), content);
}

/** A complete, publishable Creative Commons post file for skill `crochet`. */
function postFile(overrides: Record<string, unknown> = {}) {
  return {
    seedKey: "granny-square",
    publish: true,
    type: "TUTORIAL",
    title: "Your first granny square",
    description: "Four rounds, one colour.",
    skills: ["crochet"],
    primarySkill: "crochet",
    mediaFiles: [{ path: "media/square.jpg", altText: "A finished granny square" }],
    difficulty: "BEGINNER",
    estimatedMinutes: 45,
    materials: [{ name: "Cotton yarn", note: "Worsted weight" }],
    steps: [
      { text: "Make a magic ring." },
      {
        text: "Work the first round.",
        mediaFile: { path: "media/round-1.jpg", altText: "Round 1" },
      },
    ],
    attribution: {
      sourceType: "CREATIVE_COMMONS",
      license: "CC BY 4.0",
      attributionText: "Photo by Asha on Wikimedia Commons",
      originalAuthor: "Asha",
      originalUrl: "https://commons.wikimedia.org/wiki/File:Granny_square.jpg",
    },
    ...overrides,
  };
}

async function writePost(file: { seedKey: string }, name = `${file.seedKey}.json`) {
  await writeFile(path.join(folder, "posts", name), JSON.stringify(file));
}

async function importAll(options: { check?: boolean } = {}) {
  return importSeedContent(folder, { provider, ...options });
}

describe("seed content import", () => {
  beforeEach(async () => {
    await resetDatabase();
    provider = createFakeMediaProvider();
    folder = await mkdtemp(path.join(tmpdir(), "dodoi-seed-"));
    await mkdir(path.join(folder, "posts"));
    await mkdir(path.join(folder, "media"));
    await writeMedia("square.jpg");
    await writeMedia("round-1.jpg");
    await createSkill("Crochet");
  });

  afterEach(async () => {
    await rm(folder, { recursive: true, force: true });
  });

  afterAll(async () => {
    await resetDatabase();
  });

  it("creates and publishes a post with its media, skills, steps and attribution", async () => {
    await writePost(postFile());

    const [outcome] = await importAll();

    expect(outcome).toEqual({
      file: "granny-square.json",
      result: "created",
      status: "PUBLISHED",
      uploaded: 2,
    });
    const post = await db.post.findUniqueOrThrow({
      where: { seedKey: "granny-square" },
      include: {
        skills: { include: { skill: true } },
        media: { include: { media: true } },
        steps: { orderBy: { position: "asc" }, include: { media: true } },
        materials: true,
        attribution: true,
      },
    });
    expect(post).toMatchObject({ title: "Your first granny square", estimatedMinutes: 45 });
    expect(post.publishedAt).not.toBeNull();
    expect(post.skills).toEqual([expect.objectContaining({ isPrimary: true })]);
    expect(post.skills[0]?.skill.slug).toBe("crochet");
    expect(post.media[0]?.media).toMatchObject({
      altText: "A finished granny square",
      ownerId: null,
    });
    expect(post.media[0]?.media.publicId).toMatch(/^dodoi\/local\/posts\/seed-granny-square-/);
    expect(post.steps[1]?.media?.altText).toBe("Round 1");
    expect(post.materials).toHaveLength(1);
    expect(post.attribution).toMatchObject({ license: "CC BY 4.0", originalAuthor: "Asha" });
    expect(
      await db.auditLog.count({ where: { action: "post.seed_import", targetId: post.id } }),
    ).toBe(1);
  });

  it("re-running creates no duplicates and uploads nothing again", async () => {
    await writePost(postFile());
    await importAll();

    const [outcome] = await importAll();

    expect(outcome).toMatchObject({ result: "updated", status: "PUBLISHED", uploaded: 0 });
    expect(await db.post.count()).toBe(1);
    expect(await db.mediaAsset.count()).toBe(2);
    expect(provider.uploaded).toHaveLength(2);
  });

  it("updates the post from the file and deletes media it no longer uses", async () => {
    await writePost(postFile());
    await importAll();
    const gallery = await db.postMedia.findFirstOrThrow({ include: { media: true } });
    await writeMedia("square.jpg", "a re-shot photo");

    const [outcome] = await importAll();

    expect(outcome).toMatchObject({ result: "updated", uploaded: 1 });
    expect(provider.deleted).toEqual([gallery.media.publicId]);
    expect(await db.mediaAsset.count()).toBe(2);
  });

  it("unpublishes a published post when the file says publish: false", async () => {
    await writePost(postFile());
    await importAll();
    await writePost(postFile({ publish: false, title: "Granny square, take two" }));

    const [outcome] = await importAll();

    expect(outcome).toMatchObject({ result: "updated", status: "UNPUBLISHED" });
    const post = await db.post.findUniqueOrThrow({ where: { seedKey: "granny-square" } });
    expect(post).toMatchObject({ status: "UNPUBLISHED", title: "Granny square, take two" });
  });

  it("imports a draft with publish: false", async () => {
    await writePost(postFile({ publish: false }));

    const [outcome] = await importAll();

    expect(outcome).toMatchObject({ result: "created", status: "DRAFT" });
  });

  it("rejects a non-commercial Creative Commons licence and changes nothing", async () => {
    await writePost(
      postFile({
        publish: false,
        attribution: { ...postFile().attribution, license: "CC BY-NC 4.0" },
      }),
    );

    const [outcome] = await importAll();

    expect(outcome).toEqual({
      file: "granny-square.json",
      result: "failed",
      problems: ["attribution.license: Creative Commons posts must be CC BY or CC BY-SA."],
    });
    expect(await db.post.count()).toBe(0);
    expect(provider.uploaded).toHaveLength(0);
  });

  it("reports unknown skills, a missing file, a path outside the folder and a wrong seedKey", async () => {
    await writePost(
      postFile({
        skills: ["crochet", "underwater-basket-weaving"],
        mediaFiles: [{ path: "media/missing.jpg", altText: "x" }, { path: "../secret.jpg" }],
      }),
    );
    await writePost(postFile({ seedKey: "other-name" }), "granny-square-copy.json");

    const [copy, original] = await importAll();

    expect(original).toMatchObject({
      result: "failed",
      problems: [
        "skills: no skill with the slug underwater-basket-weaving.",
        "media/missing.jpg: file not found.",
        "../secret.jpg: must be inside the seed folder.",
      ],
    });
    expect(copy).toMatchObject({
      result: "failed",
      problems: ["seedKey: must match the file name (granny-square-copy.json)."],
    });
  });

  it("rejects an image Cloudinary reports as too small and deletes the upload", async () => {
    provider.uploadMetadata.set("square.jpg", { width: 400, height: 300 });
    await writePost(postFile());

    const [outcome] = await importAll();

    expect(outcome).toMatchObject({
      result: "failed",
      problems: [expect.stringMatching(/^media\/square\.jpg: That image is too small/)],
    });
    expect(provider.deleted).toHaveLength(1);
    expect(await db.post.count()).toBe(0);
  });

  it("does not publish (or save) a post that breaks the publish rules", async () => {
    await writePost(postFile({ mediaFiles: [{ path: "media/square.jpg" }] }));

    const [outcome] = await importAll();

    expect(outcome).toMatchObject({
      result: "failed",
      problems: ["This post isn't ready to publish yet.", "mediaIds: Every photo needs alt text."],
    });
    expect(await db.post.count()).toBe(0);
  });

  it("links an invited creator's post to their account", async () => {
    const creator = await createCreator();
    const username = (await db.profile.findUniqueOrThrow({ where: { userId: creator.id } }))
      .username;
    await writePost(
      postFile({
        authorUsername: username,
        attribution: {
          sourceType: "INVITED_CREATOR",
          license: "Permission granted",
          attributionText: "Made by our invited creator",
          permissionRef: "EMAIL-2026-10-01",
        },
      }),
    );

    const [outcome] = await importAll();

    expect(outcome).toMatchObject({ result: "created", status: "PUBLISHED" });
    expect(await db.post.findFirstOrThrow()).toMatchObject({ authorId: creator.id });
  });

  it("only validates with check: nothing is uploaded or saved", async () => {
    await writePost(postFile());

    expect(await importAll({ check: true })).toEqual([
      { file: "granny-square.json", result: "checked" },
    ]);
    expect(await db.post.count()).toBe(0);
    expect(provider.uploaded).toHaveLength(0);
  });
});
