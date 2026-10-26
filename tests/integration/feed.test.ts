import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { FeedQuery } from "@/lib/schemas/feed";
import type { FeedItem } from "@/lib/types/feed";
import { getActor } from "@/server/auth";
import { db } from "@/server/db/client";
import type { AuthenticatedActor } from "@/server/lib/actor";
import {
  getFeed,
  getFeedFilters,
  getSkillSuggestion,
  markNotInterested,
  undoNotInterested,
} from "@/server/modules/feed";
import { replaceMySkills } from "@/server/modules/users";

import * as feedRoute from "../../src/app/api/feed/route";
import { resetDatabase } from "../helpers/database";
import { actorFor, createPost, createSkill, createUser } from "../helpers/factories";
import { createFakeMediaProvider } from "../helpers/fake-media";

// Feed (roadmap P1-21, FEED-05/09/11/13/14): sessions without repeats, filters, discovery,
// "Not interested" and the "New to you" suggestion.

vi.mock("@/server/auth", () => ({ getActor: vi.fn() }));
const mockedGetActor = vi.mocked(getActor);
const options = { provider: createFakeMediaProvider() };

type Skill = Awaited<ReturnType<typeof createSkill>>;

async function userWithInterests(skills: Skill[]): Promise<AuthenticatedActor> {
  const user = await createUser();
  // Added one minute apart, oldest first, so "most recently added" is well defined.
  await db.userSkill.createMany({
    data: skills.map((skill, index) => ({
      userId: user.id,
      skillId: skill.id,
      isInterest: true,
      createdAt: new Date(Date.UTC(2026, 9, 1, 12, index)),
    })),
  });
  return actorFor(user);
}

async function posts(count: number, skill: Skill) {
  return Promise.all(
    Array.from({ length: count }, () => createPost({ skills: [{ id: skill.id }] })),
  );
}

function postIds(items: FeedItem[]): string[] {
  return items.flatMap((item) => (item.kind === "post" ? [item.post.id] : []));
}

function feed(actor: AuthenticatedActor, query: Partial<FeedQuery> = {}) {
  return getFeed(actor, { filter: "for-you", limit: 20, ...query }, options);
}

describe("feed", () => {
  let crochet: Skill;
  let pottery: Skill;

  beforeEach(async () => {
    await resetDatabase();
    mockedGetActor.mockReset();
    crochet = await createSkill("Crochet");
    pottery = await createSkill("Pottery");
  });

  afterAll(async () => {
    await resetDatabase();
  });

  it("never repeats a post within a session and ends with no cursor", async () => {
    const actor = await userWithInterests([crochet]);
    await posts(7, crochet);

    const first = await feed(actor, { limit: 3 });
    const second = await feed(actor, { limit: 3, cursor: first.nextCursor ?? "" });
    const third = await feed(actor, { limit: 3, cursor: second.nextCursor ?? "" });

    const all = [...postIds(first.items), ...postIds(second.items), ...postIds(third.items)];
    expect(all).toHaveLength(7);
    expect(new Set(all).size).toBe(7);
    expect(third.nextCursor).toBeNull();
  });

  it("puts at least 20% of a For you page outside the user's interests", async () => {
    const actor = await userWithInterests([crochet]);
    await posts(10, crochet);
    const outside = await posts(3, pottery);

    const page = await feed(actor, { limit: 10 });

    const ids = postIds(page.items);
    expect(ids).toHaveLength(10);
    expect(ids.filter((id) => outside.some((post) => post.id === id))).toHaveLength(2);
  });

  it("filters by an interest chip and by New to you", async () => {
    const actor = await userWithInterests([crochet]);
    const inside = await posts(2, crochet);
    const outside = await posts(2, pottery);

    const chip = await feed(actor, { filter: "skill:crochet" });
    const newToYou = await feed(actor, { filter: "new-to-you" });

    expect(postIds(chip.items).sort()).toEqual(inside.map((post) => post.id).sort());
    expect(postIds(newToYou.items).sort()).toEqual(outside.map((post) => post.id).sort());
    await expect(feed(actor, { filter: "skill:pottery" })).rejects.toMatchObject({
      code: "INVALID_FILTER",
    });
  });

  it("hides a post marked Not interested until it is undone", async () => {
    const actor = await userWithInterests([crochet]);
    const [hidden, kept] = await posts(2, crochet);

    await markNotInterested(actor, { postId: hidden?.id ?? "", type: "NOT_INTERESTED" });
    await markNotInterested(actor, { postId: hidden?.id ?? "", type: "NOT_INTERESTED" });
    expect(postIds((await feed(actor)).items)).toEqual([kept?.id]);

    await undoNotInterested(actor, { postId: hidden?.id ?? "", type: "NOT_INTERESTED" });
    expect(postIds((await feed(actor)).items)).toHaveLength(2);

    const draft = await createPost({ status: "DRAFT" });
    await expect(
      markNotInterested(actor, { postId: draft.id, type: "NOT_INTERESTED" }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("refuses another user's or an expired session", async () => {
    const actor = await userWithInterests([crochet]);
    const other = await userWithInterests([crochet]);
    await posts(3, crochet);
    const page = await feed(actor, { limit: 1 });

    await expect(feed(other, { cursor: page.nextCursor ?? "" })).rejects.toMatchObject({
      code: "FEED_SESSION_EXPIRED",
    });
    await db.feedSession.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(feed(actor, { cursor: page.nextCursor ?? "" })).rejects.toMatchObject({
      code: "FEED_SESSION_EXPIRED",
    });
  });

  it("suggests a pitched skill outside the interests, first on page 1 of For you only", async () => {
    const actor = await userWithInterests([crochet]);
    await db.skill.update({ where: { id: pottery.id }, data: { pitch: "Mud, but make it art." } });
    const embroidery = await createSkill("Embroidery");
    await db.skill.update({ where: { id: embroidery.id }, data: { pitch: "Thread painting." } });
    await db.skillRelation.create({ data: { fromSkillId: embroidery.id, toSkillId: crochet.id } });
    // Both have beginner posts; Embroidery wins because it is related to Crochet.
    for (const skill of [pottery, embroidery]) {
      const [post] = await posts(1, skill);
      await db.post.update({
        where: { id: post?.id },
        data: { difficulty: "BEGINNER", estimatedMinutes: 30 },
      });
    }
    await posts(3, crochet);

    const first = await feed(actor, { limit: 2 });
    const second = await feed(actor, { limit: 2, cursor: first.nextCursor ?? "" });
    const chip = await feed(actor, { filter: "skill:crochet" });

    expect(first.items[0]).toMatchObject({
      kind: "skill_suggestion",
      skill: { name: "Embroidery" },
      pitch: "Thread painting.",
      beginnerProjectCount: 1,
    });
    expect(second.items.some((item) => item.kind === "skill_suggestion")).toBe(false);
    expect(chip.items.some((item) => item.kind === "skill_suggestion")).toBe(false);
    expect(await getSkillSuggestion(actor, options)).toMatchObject({
      skill: { name: "Embroidery" },
    });
  });

  it("shows For you, up to 5 interests newest first (kept across edits), then New to you", async () => {
    const skills = await Promise.all(
      ["Knitting", "Weaving", "Quilting", "Macrame", "Origami"].map((name) => createSkill(name)),
    );
    const actor = await userWithInterests([crochet, ...skills]);
    // Re-saving the same interests (as the settings screen will) keeps when each was added.
    await replaceMySkills(actor, {
      items: [crochet, ...skills].map((skill) => ({
        skillId: skill.id,
        isInterest: true,
        canHelp: false,
        wantsToLearn: false,
        level: null,
      })),
    });

    const chips = await getFeedFilters(actor);

    expect(chips.map((chip) => chip.label)).toEqual([
      "For you",
      "Origami",
      "Macrame",
      "Quilting",
      "Weaving",
      "Knitting",
      "New to you",
    ]);
    expect(chips[1]?.key).toBe("skill:origami");
  });

  it("answers 401 when signed out", async () => {
    mockedGetActor.mockResolvedValue(null);
    const response = await feedRoute.GET(new NextRequest("http://localhost:3000/api/feed"), {
      params: Promise.resolve({}),
    });
    expect(response.status).toBe(401);
  });
});
