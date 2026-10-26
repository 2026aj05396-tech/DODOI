import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { CreateAdminPostInput } from "@/lib/schemas/admin";
import { getActor } from "@/server/auth";
import { db } from "@/server/db/client";
import type { AuthenticatedActor } from "@/server/lib/actor";
import {
  createAdminPost,
  createAdminTheme,
  deleteAdminPost,
  deleteAdminTheme,
  getPostDetail,
  listAdminPosts,
  publishPost,
  unpublishPost,
  updateAdminPost,
  updateAdminTheme,
} from "@/server/modules/content";
import { listSkills, setRelatedSkills, updateAdminSkill } from "@/server/modules/skills";

import * as adminPostsRoute from "../../src/app/api/admin/posts/route";
import { resetDatabase } from "../helpers/database";
import {
  actorFor,
  createCreator,
  createMedia,
  createPost,
  createSkill,
  createUser,
} from "../helpers/factories";
import { createFakeMediaProvider } from "../helpers/fake-media";

// Admin API (roadmap P1-16, API_SPECIFICATION §8): admin only (404), every mutation audited.

vi.mock("@/server/auth", () => ({ getActor: vi.fn() }));
const mockedGetActor = vi.mocked(getActor);

const provider = createFakeMediaProvider();
const options = { provider };

async function admin(): Promise<AuthenticatedActor> {
  return actorFor(await createUser(), "ADMIN");
}

/** A complete team-original post body. */
async function readyPost(
  overrides: Partial<CreateAdminPostInput> = {},
): Promise<CreateAdminPostInput> {
  const skill = await createSkill(`Skill ${Math.random().toString(36).slice(2, 8)}`);
  const media = await createMedia();
  return {
    type: "TUTORIAL",
    title: "Pipe cleaner bumblebee",
    description: "A tiny bee for beginners.",
    skillIds: [skill.id],
    primarySkillId: skill.id,
    mediaIds: [media.id],
    difficulty: "BEGINNER",
    estimatedMinutes: 30,
    materials: [{ name: "Yellow pipe cleaners", note: "2 pieces" }],
    steps: [{ text: "Twist the pipe cleaners together.", mediaId: null }],
    attribution: {
      sourceType: "TEAM_ORIGINAL",
      license: "Owned",
      attributionText: "Made by the dodoi team",
      originalAuthor: null,
      originalUrl: null,
      permissionRef: null,
    },
    authorUsername: null,
    ...overrides,
  };
}

async function auditActions(targetId: string): Promise<string[]> {
  const rows = await db.auditLog.findMany({ where: { targetId }, orderBy: { createdAt: "asc" } });
  return rows.map((row) => row.action);
}

describe("admin API", () => {
  beforeEach(async () => {
    await resetDatabase();
    mockedGetActor.mockResolvedValue(null);
  });

  afterAll(async () => {
    await resetDatabase();
    await db.$disconnect();
  });

  it("answers 404 to everyone but admins, through services and routes", async () => {
    const user = actorFor(await createUser());
    const body = await readyPost();

    for (const actor of [null, user]) {
      await expect(createAdminPost(actor, body, options)).rejects.toMatchObject({ status: 404 });
      await expect(listAdminPosts(actor, { limit: 20 }, options)).rejects.toMatchObject({
        status: 404,
      });
    }
    mockedGetActor.mockResolvedValue(user);
    const response = await adminPostsRoute.GET(
      new NextRequest("http://localhost:3000/api/admin/posts"),
      {
        params: Promise.resolve({}),
      },
    );
    expect(response.status).toBe(404);
  });

  describe("posts", () => {
    it("creates a draft with everything in order and audits it", async () => {
      const actor = await admin();
      const body = await readyPost();

      const post = await createAdminPost(actor, body, options);

      expect(post).toMatchObject({
        status: "DRAFT",
        title: "Pipe cleaner bumblebee",
        skillIds: body.skillIds,
        primarySkillId: body.primarySkillId,
        materials: [{ name: "Yellow pipe cleaners", note: "2 pieces" }],
        steps: [{ text: "Twist the pipe cleaners together.", mediaId: null, media: null }],
        attribution: { sourceType: "TEAM_ORIGINAL", permissionRef: null },
        publishedAt: null,
      });
      expect(await auditActions(post.id)).toEqual(["post.create"]);
      await expect(getPostDetail(null, post.id, options)).rejects.toMatchObject({ status: 404 });
    });

    it("rejects unknown skills, media and author usernames on their fields", async () => {
      const actor = await admin();

      await expect(
        createAdminPost(
          actor,
          await readyPost({
            skillIds: ["nope"],
            primarySkillId: "nope",
            mediaIds: ["missing"],
            authorUsername: "ghost",
          }),
          options,
        ),
      ).rejects.toMatchObject({
        status: 400,
        fields: {
          skillIds: expect.any(String),
          mediaIds: expect.any(String),
          authorUsername: "No dodoi account has that username.",
        },
      });
    });

    it("publishes only a complete post, then shows it publicly", async () => {
      const actor = await admin();
      const draft = await createAdminPost(
        actor,
        { ...(await readyPost()), mediaIds: [], attribution: null },
        options,
      );

      await expect(publishPost(actor, draft.id, options)).rejects.toMatchObject({
        status: 400,
        code: "POST_NOT_PUBLISHABLE",
        fields: { mediaIds: expect.any(String), attribution: expect.any(String) },
      });
      const media = await createMedia();
      await updateAdminPost(
        actor,
        draft.id,
        { mediaIds: [media.id], attribution: (await readyPost()).attribution },
        options,
      );
      const published = await publishPost(actor, draft.id, options);

      expect(published.status).toBe("PUBLISHED");
      expect((await getPostDetail(null, draft.id, options)).title).toBe("Pipe cleaner bumblebee");
      expect(await auditActions(draft.id)).toEqual(["post.create", "post.update", "post.publish"]);
    });

    it("links an invited creator's account and needs their permission reference", async () => {
      const actor = await admin();
      const creator = await createCreator();
      const profile = await db.profile.findUniqueOrThrow({ where: { userId: creator.id } });
      const post = await createAdminPost(
        actor,
        await readyPost({
          authorUsername: profile.username,
          attribution: {
            sourceType: "INVITED_CREATOR",
            license: "Permission granted",
            attributionText: "Shared with permission",
            originalAuthor: null,
            originalUrl: null,
            permissionRef: null,
          },
        }),
        options,
      );

      await expect(publishPost(actor, post.id, options)).rejects.toMatchObject({
        fields: { "attribution.permissionRef": expect.any(String) },
      });
      await updateAdminPost(
        actor,
        post.id,
        {
          attribution: {
            sourceType: "INVITED_CREATOR",
            license: "Permission granted",
            attributionText: "Shared with permission",
            permissionRef: "Email of 2026-10-01",
          },
        },
        options,
      );
      await publishPost(actor, post.id, options);

      expect((await getPostDetail(null, post.id, options)).creator?.username).toBe(
        profile.username,
      );
    });

    it("refuses an edit that would break a published post, and keeps the post as it was", async () => {
      const actor = await admin();
      const post = await createAdminPost(actor, await readyPost(), options);
      await publishPost(actor, post.id, options);

      await expect(
        updateAdminPost(actor, post.id, { mediaIds: [], title: "Changed" }, options),
      ).rejects.toMatchObject({ code: "POST_NOT_PUBLISHABLE" });

      const after = await getPostDetail(null, post.id, options);
      expect(after.title).toBe("Pipe cleaner bumblebee");
      expect(after.mediaCount).toBe(1);
    });

    it("updates the search index when a post is edited", async () => {
      const actor = await admin();
      const post = await createAdminPost(actor, await readyPost(), options);

      await updateAdminPost(actor, post.id, { title: "Felted hedgehog" }, options);

      const rows = await db.$queryRaw<{ id: string }[]>`
        SELECT id FROM post WHERE search_vector @@ plainto_tsquery('simple', 'hedgehog')
      `;
      expect(rows).toEqual([{ id: post.id }]);
    });

    it("unpublishes, and keeps the first publication time when published again", async () => {
      const actor = await admin();
      const post = await createAdminPost(actor, await readyPost(), options);
      const first = await publishPost(actor, post.id, options);

      await unpublishPost(actor, post.id, options);
      await expect(getPostDetail(null, post.id, options)).rejects.toMatchObject({ status: 404 });
      const again = await publishPost(actor, post.id, options);

      expect(again.publishedAt).toBe(first.publishedAt);
    });

    it("deletes a post and its media used nowhere else", async () => {
      const actor = await admin();
      const shared = await createMedia();
      const own = await createMedia();
      await createPost({ title: "Other" });
      await db.postMedia.create({
        data: {
          postId: (await db.post.findFirstOrThrow({ where: { title: "Other" } })).id,
          mediaId: shared.id,
          position: 1,
        },
      });
      const fake = createFakeMediaProvider();
      const post = await createAdminPost(
        actor,
        await readyPost({ mediaIds: [own.id, shared.id] }),
        options,
      );

      await deleteAdminPost(actor, post.id, { provider: fake });

      expect(fake.deleted).toEqual([own.publicId]);
      expect(await db.mediaAsset.count({ where: { id: { in: [own.id, shared.id] } } })).toBe(1);
      expect(await auditActions(post.id)).toEqual(["post.create", "post.delete"]);
    });

    it("lists posts by status, newest change first", async () => {
      const actor = await admin();
      const draft = await createAdminPost(actor, await readyPost({ title: "Draft one" }), options);
      const live = await createAdminPost(actor, await readyPost({ title: "Live one" }), options);
      await publishPost(actor, live.id, options);

      const all = await listAdminPosts(actor, { limit: 20 }, options);
      const drafts = await listAdminPosts(actor, { limit: 20, status: "DRAFT" }, options);

      expect(all.items.map((item) => item.title)).toEqual(["Live one", "Draft one"]);
      expect(drafts.items.map((item) => item.id)).toEqual([draft.id]);
    });
  });

  describe("themes", () => {
    it("creates, reorders and deletes a theme, refusing a taken slug", async () => {
      const actor = await admin();
      const [a, b] = await Promise.all([createPost({ title: "A" }), createPost({ title: "B" })]);

      const theme = await createAdminTheme(
        actor,
        {
          slug: "cosy-nights",
          title: "Cosy nights",
          isPublished: true,
          position: 0,
          postIds: [a.id, b.id],
        },
        options,
      );
      await expect(
        createAdminTheme(
          actor,
          { slug: "cosy-nights", title: "Again", isPublished: false, position: 1, postIds: [] },
          options,
        ),
      ).rejects.toMatchObject({ status: 409, code: "SLUG_TAKEN" });
      const reordered = await updateAdminTheme(actor, theme.id, { postIds: [b.id, a.id] }, options);
      await deleteAdminTheme(actor, theme.id);

      expect(reordered.postIds).toEqual([b.id, a.id]);
      expect(await db.theme.count()).toBe(0);
      expect(await db.post.count()).toBe(2);
      expect(await auditActions(theme.id)).toEqual([
        "theme.create",
        "theme.update",
        "theme.delete",
      ]);
    });
  });

  describe("skills", () => {
    it("edits a skill and can hide even a predefined one", async () => {
      const actor = await admin();
      const user = actorFor(await createUser());
      const skill = await createSkill("Crochet");

      const edited = await updateAdminSkill(actor, skill.id, {
        pitch: "Hooks, loops, cosy things",
      });
      const hidden = await updateAdminSkill(actor, skill.id, { status: "HIDDEN" });

      expect(edited.pitch).toBe("Hooks, loops, cosy things");
      expect(hidden.status).toBe("HIDDEN");
      expect((await listSkills(user, { limit: 20 })).items).toEqual([]);
      expect(await auditActions(skill.id)).toEqual(["skill.update", "skill.hide"]);
    });

    it("sets related skills in both directions and refuses itself", async () => {
      const actor = await admin();
      const [crochet, knitting, felting] = await Promise.all([
        createSkill("Crochet"),
        createSkill("Knitting"),
        createSkill("Felting"),
      ]);

      const result = await setRelatedSkills(actor, crochet.id, {
        skillIds: [knitting.id, felting.id],
      });

      expect(new Set(result.relatedSkillIds)).toEqual(new Set([knitting.id, felting.id]));
      expect(await db.skillRelation.count({ where: { toSkillId: crochet.id } })).toBe(2);
      await expect(
        setRelatedSkills(actor, crochet.id, { skillIds: [crochet.id] }),
      ).rejects.toMatchObject({
        status: 400,
      });
    });

    it("rejects a cover image that doesn't exist", async () => {
      const skill = await createSkill("Crochet");

      await expect(
        updateAdminSkill(await admin(), skill.id, { coverMediaId: "missing" }),
      ).rejects.toMatchObject({ status: 400, fields: { coverMediaId: expect.any(String) } });
    });
  });
});
