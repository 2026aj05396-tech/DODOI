import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { getActor } from "@/server/auth";
import { db } from "@/server/db/client";
import type { AuthenticatedActor } from "@/server/lib/actor";
import { getPostProgress, updateAdminPost, updatePostProgress } from "@/server/modules/content";

import * as progressRoute from "../../src/app/api/posts/[postId]/progress/route";
import { resetDatabase } from "../helpers/database";
import { actorFor, createPost, createSkill, createUser } from "../helpers/factories";
import { createFakeMediaProvider } from "../helpers/fake-media";

// Tutorial progress (roadmap P1-20b, POST-11/12): private to each user, ids checked against the
// post, ticks survive admin edits that keep a material.

vi.mock("@/server/auth", () => ({ getActor: vi.fn() }));
const mockedGetActor = vi.mocked(getActor);

async function user(): Promise<AuthenticatedActor> {
  return actorFor(await createUser());
}

async function tutorial(status: "PUBLISHED" | "DRAFT" = "PUBLISHED") {
  const skill = await createSkill(`Crochet ${Math.random().toString(36).slice(2, 8)}`);
  const post = await createPost({
    status,
    skills: [{ id: skill.id }],
    materials: ["Cotton yarn", "4 mm hook", "Scissors"],
    steps: ["Make a magic ring.", "Work round 1.", "Work round 2."],
  });
  const materials = await db.postMaterial.findMany({
    where: { postId: post.id },
    orderBy: { position: "asc" },
  });
  return { post, materialIds: materials.map((material) => material.id) };
}

describe("tutorial progress", () => {
  beforeEach(async () => {
    await resetDatabase();
    mockedGetActor.mockReset();
  });

  afterAll(async () => {
    await resetDatabase();
  });

  it("starts empty, saves ticks and keeps each list unless it is sent", async () => {
    const actor = await user();
    const { post, materialIds } = await tutorial();

    expect(await getPostProgress(actor, post.id)).toEqual({
      checkedMaterialIds: [],
      completedStepPositions: [],
      updatedAt: null,
    });

    await updatePostProgress(actor, post.id, { checkedMaterialIds: [materialIds[0] ?? ""] });
    const progress = await updatePostProgress(actor, post.id, { completedStepPositions: [1, 0] });

    expect(progress).toMatchObject({
      checkedMaterialIds: [materialIds[0]],
      completedStepPositions: [0, 1],
    });
    expect(progress.updatedAt).not.toBeNull();
    expect(await getPostProgress(actor, post.id)).toEqual(progress);
  });

  it("is private: another user sees their own empty progress", async () => {
    const owner = await user();
    const other = await user();
    const { post } = await tutorial();
    await updatePostProgress(owner, post.id, { completedStepPositions: [0] });

    expect((await getPostProgress(other, post.id)).completedStepPositions).toEqual([]);
  });

  it("rejects materials and steps that aren't part of the post", async () => {
    const actor = await user();
    const { post } = await tutorial();
    const otherPost = await tutorial();

    await expect(
      updatePostProgress(actor, post.id, {
        checkedMaterialIds: [otherPost.materialIds[0] ?? ""],
        completedStepPositions: [7],
      }),
    ).rejects.toMatchObject({
      status: 400,
      fields: {
        checkedMaterialIds: "Some materials aren't part of this post.",
        completedStepPositions: "Some steps aren't part of this post.",
      },
    });
  });

  it("answers 404 for drafts and 401 when signed out", async () => {
    const actor = await user();
    const { post } = await tutorial("DRAFT");

    await expect(getPostProgress(actor, post.id)).rejects.toMatchObject({ status: 404 });

    mockedGetActor.mockResolvedValue(null);
    const response = await progressRoute.GET(
      new NextRequest(`http://localhost:3000/api/posts/${post.id}/progress`),
      { params: Promise.resolve({ postId: post.id }) },
    );
    expect(response.status).toBe(401);
  });

  it("keeps ticks on materials an admin edit keeps, and drops the removed ones", async () => {
    const actor = await user();
    const admin = actorFor(await createUser(), "ADMIN");
    const { post, materialIds } = await tutorial();
    await updatePostProgress(actor, post.id, { checkedMaterialIds: materialIds });

    await updateAdminPost(
      admin,
      post.id,
      { materials: [{ name: "Scissors" }, { name: "Cotton yarn", note: "any colour" }] },
      { provider: createFakeMediaProvider() },
    );

    const progress = await getPostProgress(actor, post.id);
    expect(progress.checkedMaterialIds.sort()).toEqual([materialIds[0], materialIds[2]].sort());
    const materials = await db.postMaterial.findMany({
      where: { postId: post.id },
      orderBy: { position: "asc" },
    });
    expect(materials.map((material) => [material.id, material.name, material.note])).toEqual([
      [materialIds[2], "Scissors", null],
      [materialIds[0], "Cotton yarn", "any colour"],
    ]);
  });
});
