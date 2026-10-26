import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { getActor } from "@/server/auth";
import { db } from "@/server/db/client";
import {
  getPostDetail,
  getRelatedPosts,
  getTheme,
  listSkillPosts,
  listThemes,
  refreshPostSearchIndex,
} from "@/server/modules/content";

import * as postRoute from "../../src/app/api/posts/[postId]/route";
import { resetDatabase } from "../helpers/database";
import { actorFor, createCreator, createPost, createSkill, createUser } from "../helpers/factories";
import { createFakeMediaProvider } from "../helpers/fake-media";

// Content read models (roadmap P1-15, API_SPECIFICATION §5).

vi.mock("@/server/auth", () => ({ getActor: vi.fn() }));
const mockedGetActor = vi.mocked(getActor);

const provider = createFakeMediaProvider();
const page = { limit: 20 };
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);

describe("content", () => {
  beforeEach(async () => {
    await resetDatabase();
    mockedGetActor.mockResolvedValue(null);
  });

  afterAll(async () => {
    await resetDatabase();
    await db.$disconnect();
  });

  describe("post detail", () => {
    it("shows a published post to signed-out visitors, with ordered media, materials and steps", async () => {
      const crochet = await createSkill("Crochet");
      const post = await createPost({
        title: "Granny square",
        skills: [{ id: crochet.id }],
        mediaCount: 2,
        materials: ["Yarn", "Hook"],
        steps: ["Chain 4", "Join"],
      });

      const detail = await getPostDetail(null, post.id, { provider });

      expect(detail).toMatchObject({
        title: "Granny square",
        mediaCount: 2,
        primarySkillId: crochet.id,
        skills: [expect.objectContaining({ name: "Crochet" })],
        creator: null,
        attribution: { sourceType: "TEAM_ORIGINAL", license: "Owned" },
        isSaved: false,
        materials: [
          { name: "Yarn", note: null, id: expect.any(String) },
          { name: "Hook", note: null, id: expect.any(String) },
        ],
        steps: [
          { position: 0, text: "Chain 4", media: null },
          { position: 1, text: "Join", media: null },
        ],
      });
      expect(detail.media.map((media) => media.altText)).toEqual(["Photo 1", "Photo 2"]);
      const cover = await db.postMedia.findFirstOrThrow({
        where: { postId: post.id, position: 0 },
        select: { media: { select: { publicId: true } } },
      });
      expect(detail.coverMedia.url).toBe(`https://cdn.test/image/${cover.media.publicId}`);
    });

    it("hides drafts and unpublished posts from everyone but admins", async () => {
      const draft = await createPost({ status: "DRAFT" });
      const unpublished = await createPost({ status: "UNPUBLISHED" });
      const user = actorFor(await createUser());
      const admin = actorFor(await createUser(), "ADMIN");

      for (const actor of [null, user]) {
        await expect(getPostDetail(actor, draft.id, { provider })).rejects.toMatchObject({
          status: 404,
        });
        await expect(getPostDetail(actor, unpublished.id, { provider })).rejects.toMatchObject({
          status: 404,
        });
      }
      expect((await getPostDetail(admin, draft.id, { provider })).id).toBe(draft.id);
    });

    it("tells a signed-in user whether they saved it", async () => {
      const user = await createUser();
      const post = await createPost();
      await db.save.create({ data: { userId: user.id, postId: post.id } });

      expect((await getPostDetail(actorFor(user), post.id, { provider })).isSaved).toBe(true);
      expect((await getPostDetail(null, post.id, { provider })).isSaved).toBe(false);
    });

    it("shows an invited creator, but not a hidden or deactivated one", async () => {
      const [visible, hidden, gone] = await Promise.all([
        createCreator(),
        createCreator({ isHidden: true }),
        createCreator({ deactivated: true }),
      ]);
      const posts = await Promise.all(
        [visible, hidden, gone].map((author) =>
          createPost({ authorId: author.id, sourceType: "INVITED_CREATOR" }),
        ),
      );

      const creators = await Promise.all(
        posts.map(async (post) => (await getPostDetail(null, post.id, { provider })).creator),
      );

      expect(creators).toEqual([
        {
          username: expect.stringMatching(/^creator-/),
          displayName: expect.any(String),
          avatarUrl: null,
        },
        null,
        null,
      ]);
    });

    it("leaves hidden skills off the post", async () => {
      const [crochet, hidden] = await Promise.all([
        createSkill("Crochet"),
        createSkill("Hidden thing", { status: "HIDDEN" }),
      ]);
      const post = await createPost({ skills: [{ id: crochet.id }, { id: hidden.id }] });

      expect((await getPostDetail(null, post.id, { provider })).skills.map((s) => s.name)).toEqual([
        "Crochet",
      ]);
    });

    it("is public through the route, and drafts are 404", async () => {
      const post = await createPost();
      const draft = await createPost({ status: "DRAFT" });
      const call = (id: string) =>
        postRoute.GET(new NextRequest(`http://localhost:3000/api/posts/${id}`), {
          params: Promise.resolve({ postId: id }),
        });

      expect((await call(post.id)).status).toBe(200);
      expect((await call(draft.id)).status).toBe(404);
    });
  });

  describe("related posts", () => {
    it("ranks by shared skills, then same primary skill, then newest; never itself or drafts", async () => {
      const [a, b, c] = await Promise.all([
        createSkill("Crochet"),
        createSkill("Knitting"),
        createSkill("Felting"),
      ]);
      const post = await createPost({
        title: "Main",
        skills: [{ id: a.id, primary: true }, { id: b.id }],
      });
      await createPost({
        title: "Shares both",
        skills: [{ id: b.id }, { id: a.id }],
        publishedAt: minutesAgo(50),
      });
      await createPost({
        title: "Same primary",
        skills: [{ id: a.id, primary: true }],
        publishedAt: minutesAgo(40),
      });
      await createPost({
        title: "Other primary, newer",
        skills: [{ id: b.id, primary: true }],
        publishedAt: minutesAgo(1),
      });
      await createPost({
        title: "Other primary, older",
        skills: [{ id: b.id, primary: true }],
        publishedAt: minutesAgo(30),
      });
      await createPost({ title: "Unrelated", skills: [{ id: c.id }] });
      await createPost({ title: "Draft", status: "DRAFT", skills: [{ id: a.id }, { id: b.id }] });

      const related = await getRelatedPosts(null, post.id, { provider });

      expect(related.map((card) => card.title)).toEqual([
        "Shares both",
        "Same primary",
        "Other primary, newer",
        "Other primary, older",
      ]);
    });

    it("returns at most 12", async () => {
      const skill = await createSkill("Crochet");
      const post = await createPost({ skills: [{ id: skill.id }] });
      for (let index = 0; index < 14; index += 1) await createPost({ skills: [{ id: skill.id }] });

      expect(await getRelatedPosts(null, post.id, { provider })).toHaveLength(12);
    });
  });

  describe("skill posts", () => {
    it("lists a skill's published posts newest first, page by page", async () => {
      const actor = actorFor(await createUser());
      const skill = await createSkill("Crochet");
      for (const [title, age] of [
        ["Old", 30],
        ["Middle", 20],
        ["New", 10],
      ] as const) {
        await createPost({ title, skills: [{ id: skill.id }], publishedAt: minutesAgo(age) });
      }
      await createPost({ title: "Draft", status: "DRAFT", skills: [{ id: skill.id }] });

      const first = await listSkillPosts(actor, "crochet", { limit: 2 }, { provider });
      const second = await listSkillPosts(
        actor,
        "crochet",
        { limit: 2, cursor: first.nextCursor ?? undefined },
        { provider },
      );

      expect(first.items.map((card) => card.title)).toEqual(["New", "Middle"]);
      expect(second.items.map((card) => card.title)).toEqual(["Old"]);
      expect(second.nextCursor).toBeNull();
    });

    it("needs sign-in, and a hidden skill is 404", async () => {
      await createSkill("Hidden thing", { status: "HIDDEN" });

      await expect(listSkillPosts(null, "crochet", page, { provider })).rejects.toMatchObject({
        status: 401,
      });
      await expect(
        listSkillPosts(actorFor(await createUser()), "hidden-thing", page, { provider }),
      ).rejects.toMatchObject({ status: 404 });
    });
  });

  describe("themes", () => {
    it("lists published themes and their published posts in curated order", async () => {
      const actor = actorFor(await createUser());
      const [first, second, draft] = await Promise.all([
        createPost({ title: "First" }),
        createPost({ title: "Second" }),
        createPost({ title: "Draft", status: "DRAFT" }),
      ]);
      await db.theme.create({
        data: {
          slug: "cosy-nights",
          title: "Cosy nights",
          isPublished: true,
          posts: {
            create: [
              { postId: second.id, position: 1 },
              { postId: first.id, position: 0 },
              { postId: draft.id, position: 2 },
            ],
          },
        },
      });
      await db.theme.create({ data: { slug: "secret", title: "Secret", isPublished: false } });

      const themes = await listThemes(actor, { provider });
      const theme = await getTheme(actor, "cosy-nights", page, { provider });

      expect(themes.map((item) => item.slug)).toEqual(["cosy-nights"]);
      expect(theme.posts.items.map((card) => card.title)).toEqual(["First", "Second"]);
      await expect(getTheme(actor, "secret", page, { provider })).rejects.toMatchObject({
        status: 404,
      });
    });
  });

  it("indexes title, description and skill names for search", async () => {
    const skill = await createSkill("Amigurumi");
    const post = await createPost({
      title: "Tiny whale",
      description: "A weekend project",
      skills: [{ id: skill.id }],
    });

    await refreshPostSearchIndex(post.id);

    const match = (term: string) =>
      db.$queryRaw<{ id: string }[]>`
        SELECT id FROM post WHERE search_vector @@ plainto_tsquery('simple', ${term})
      `;
    expect(await match("whale")).toEqual([{ id: post.id }]);
    expect(await match("weekend")).toEqual([{ id: post.id }]);
    expect(await match("amigurumi")).toEqual([{ id: post.id }]);
    expect(await match("crochet")).toEqual([]);
  });
});
