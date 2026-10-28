import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/server/db/client";
import { getSeedCoverage } from "@/server/modules/content";

import { resetDatabase } from "../helpers/database";
import { actorFor, createPost, createSkill, createUser } from "../helpers/factories";

// Admin Coverage (P1-19, OD-31): admin only; counts published posts against the minimums, for
// active predefined skills and published themes only.

describe("getSeedCoverage", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("is for admins only", async () => {
    await expect(getSeedCoverage(actorFor(await createUser()))).rejects.toMatchObject({
      status: 404,
    });
    await expect(getSeedCoverage(null)).rejects.toMatchObject({ status: 404 });
  });

  it("counts published posts toward active predefined skills and published themes", async () => {
    const crochet = await createSkill("Crochet");
    const weaving = await createSkill("Weaving");
    await createSkill("Hidden craft", { status: "HIDDEN" });
    await createSkill("My own craft", { origin: "CUSTOM" });

    const published = await Promise.all([
      createPost({ skills: [{ id: crochet.id }, { id: weaving.id }] }),
      createPost({ skills: [{ id: weaving.id }] }),
    ]);
    await createPost({ status: "DRAFT", skills: [{ id: weaving.id }] });
    await createPost({ status: "UNPUBLISHED", skills: [{ id: crochet.id }] });

    await db.theme.create({
      data: {
        slug: "cosy",
        title: "Cosy evenings",
        isPublished: true,
        posts: { create: published.map((post, position) => ({ postId: post.id, position })) },
      },
    });
    await db.theme.create({ data: { slug: "draft-theme", title: "Draft", isPublished: false } });

    const coverage = await getSeedCoverage(actorFor(await createUser(), "ADMIN"));

    // Only the two active predefined skills; crochet is a launch-focus skill.
    expect(coverage.skills.map((row) => row.slug)).toEqual(["crochet", "weaving"]);
    expect(coverage.skills[0]).toMatchObject({ focus: true, posts: 1, tutorials: 1, met: false });
    expect(coverage.skills[1]).toMatchObject({ focus: false, posts: 2, minPosts: 2, met: true });
    expect(coverage.types.find((row) => row.type === "TUTORIAL")?.posts).toBe(2);
    expect(coverage.themes).toEqual([
      { slug: "cosy", title: "Cosy evenings", posts: 2, min: 6, met: false },
    ]);
    expect(coverage.missingFocusSkills).not.toContain("crochet");
  });
});
