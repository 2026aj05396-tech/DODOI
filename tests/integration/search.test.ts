import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { SearchQuery } from "@/lib/schemas/search";
import type { Paginated } from "@/lib/types/api";
import type { CreatorSummary, PostCard } from "@/lib/types/posts";
import type { SearchAll } from "@/lib/types/search";
import { getActor } from "@/server/auth";
import { db } from "@/server/db/client";
import type { AuthenticatedActor } from "@/server/lib/actor";
import { refreshPostSearchIndex } from "@/server/modules/content";
import { explore, search } from "@/server/modules/search";

import * as searchRoute from "../../src/app/api/search/route";
import { resetDatabase } from "../helpers/database";
import { actorFor, createCreator, createPost, createSkill, createUser } from "../helpers/factories";
import { createFakeMediaProvider } from "../helpers/fake-media";

// Search and Explore (roadmap P1-23; SRCH-01…08): partial and typo-tolerant matching, custom
// skills findable, private/hidden makers excluded, query limits enforced.

vi.mock("@/server/auth", () => ({ getActor: vi.fn() }));
const mockedGetActor = vi.mocked(getActor);
const options = { provider: createFakeMediaProvider() };

async function user(): Promise<AuthenticatedActor> {
  return actorFor(await createUser());
}

async function indexedPost(
  title: string,
  skillId: string,
  extra: Parameters<typeof createPost>[0] = {},
) {
  const post = await createPost({ title, skills: [{ id: skillId }], ...extra });
  await refreshPostSearchIndex(post.id);
  return post;
}

function all(actor: AuthenticatedActor, q: string) {
  return search(actor, { q, type: "all", limit: 20 } as SearchQuery, options) as Promise<SearchAll>;
}

describe("search", () => {
  beforeEach(async () => {
    await resetDatabase();
    mockedGetActor.mockReset();
  });

  afterAll(async () => {
    await resetDatabase();
  });

  it("finds skills and posts from part of a word: croch → Crochet", async () => {
    const actor = await user();
    const crochet = await createSkill("Crochet");
    const pottery = await createSkill("Pottery");
    const square = await indexedPost("Your first granny square", crochet.id);
    await indexedPost("Pinch-pot planters", pottery.id);

    const results = await all(actor, "croch");

    expect(results.skills.map((skill) => skill.name)).toEqual(["Crochet"]);
    // Found through its skill name in the search index.
    expect(results.posts.map((post) => post.id)).toEqual([square.id]);
  });

  it("tolerates typos in post titles and skill names", async () => {
    const actor = await user();
    const embroidery = await createSkill("Embroidery");
    const post = await indexedPost("Watercolor florals", embroidery.id);

    expect((await all(actor, "watercolr")).posts.map((card) => card.id)).toEqual([post.id]);
    expect((await all(actor, "embroidry")).skills.map((skill) => skill.name)).toEqual([
      "Embroidery",
    ]);
  });

  it("finds custom skills and never unpublished posts", async () => {
    const actor = await user();
    const custom = await createSkill("Lippan mirror work", { origin: "CUSTOM" });
    await indexedPost("Lippan panel draft", custom.id, { status: "DRAFT" });

    const results = await all(actor, "lippan");

    expect(results.skills.map((skill) => skill.name)).toEqual(["Lippan mirror work"]);
    expect(results.posts).toEqual([]);
  });

  it("finds public makers by username or a word of their name, never private or hidden ones", async () => {
    const actor = await user();
    const visible = await createCreator();
    await db.profile.update({
      where: { userId: visible.id },
      data: { username: "aanya-makes", displayName: "Aanya Verma" },
    });
    const privateOne = await createCreator();
    await db.profile.update({
      where: { userId: privateOne.id },
      data: { username: "aanya-private", visibility: "PRIVATE" },
    });
    const hidden = await createCreator({ isHidden: true });
    await db.profile.update({ where: { userId: hidden.id }, data: { username: "aanya-hidden" } });
    const gone = await createCreator({ deactivated: true });
    await db.profile.update({ where: { userId: gone.id }, data: { username: "aanya-gone" } });

    expect((await all(actor, "aanya")).creators.map((creator) => creator.username)).toEqual([
      "aanya-makes",
    ]);
    expect((await all(actor, "verma")).creators.map((creator) => creator.username)).toEqual([
      "aanya-makes",
    ]);
  });

  it("pages a single type with a cursor", async () => {
    const actor = await user();
    const crochet = await createSkill("Crochet");
    for (const title of ["Crochet one", "Crochet two", "Crochet three"]) {
      await indexedPost(title, crochet.id);
    }

    const first = (await search(
      actor,
      { q: "crochet", type: "posts", limit: 2 },
      options,
    )) as Paginated<PostCard>;
    const second = (await search(
      actor,
      { q: "crochet", type: "posts", limit: 2, cursor: first.nextCursor ?? "" },
      options,
    )) as Paginated<PostCard>;

    expect(first.items).toHaveLength(2);
    expect(second.items).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
    expect(new Set([...first.items, ...second.items].map((post) => post.id)).size).toBe(3);

    const creators = (await search(
      actor,
      { q: "nobody", type: "creators", limit: 5 },
      options,
    )) as Paginated<CreatorSummary>;
    expect(creators).toEqual({ items: [], nextCursor: null });
  });

  it("limits searches to 60 a minute and needs sign-in", async () => {
    const actor = await user();
    for (let index = 0; index < 60; index += 1) await all(actor, "x");

    await expect(all(actor, "x")).rejects.toMatchObject({ status: 429 });

    mockedGetActor.mockResolvedValue(null);
    const response = await searchRoute.GET(
      new NextRequest("http://localhost:3000/api/search?q=crochet"),
      { params: Promise.resolve({}) },
    );
    expect(response.status).toBe(401);
  });
});

describe("explore", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("lists popular (saves, topped up by posts), new and to-try skills, themes and beginner posts", async () => {
    const actor = await user();
    const crochet = await createSkill("Crochet");
    const pottery = await createSkill("Pottery");
    const knitting = await createSkill("Knitting");
    await db.skill.update({ where: { id: pottery.id }, data: { hint: "Beginner friendly" } });
    await db.skill.update({ where: { id: knitting.id }, data: { hint: "Pairs with crochet" } });
    await db.skillRelation.create({ data: { fromSkillId: knitting.id, toSkillId: crochet.id } });
    await db.userSkill.create({
      data: { userId: actor.id, skillId: crochet.id, isInterest: true },
    });

    // Pottery: one saved post. Crochet: two posts, never saved. Knitting: nothing.
    const savedPottery = await createPost({ skills: [{ id: pottery.id }] });
    await createPost({ skills: [{ id: crochet.id }] });
    const beginner = await createPost({ skills: [{ id: crochet.id }] });
    await db.post.update({ where: { id: beginner.id }, data: { difficulty: "BEGINNER" } });
    await db.save.create({ data: { userId: (await createUser()).id, postId: savedPottery.id } });
    const theme = await db.theme.create({
      data: { slug: "slow-sundays", title: "Slow Sundays", isPublished: true },
    });
    await db.themePost.create({ data: { themeId: theme.id, postId: beginner.id, position: 0 } });

    const data = await explore(actor, options);

    expect(data.popularSkills.map((skill) => skill.name)).toEqual(["Pottery", "Crochet"]);
    expect(data.newSkills.map((skill) => skill.name)).toEqual(["Knitting", "Pottery", "Crochet"]);
    expect(data.skillsToTry).toEqual([
      { skill: expect.objectContaining({ name: "Knitting" }), hint: "Pairs with crochet" },
      { skill: expect.objectContaining({ name: "Pottery" }), hint: "Beginner friendly" },
    ]);
    expect(data.themes).toEqual([expect.objectContaining({ title: "Slow Sundays", postCount: 1 })]);
    expect(data.beginnerFriendly.map((post) => post.id)).toEqual([beginner.id]);
  });
});
