import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/server/db/client";
import type { AuthenticatedActor } from "@/server/lib/actor";
import { RateLimitError } from "@/server/lib/errors";
import {
  createOwnPost,
  deleteOwnPost,
  getFeedCandidates,
  getOwnPost,
  getPostDetail,
  listOwnPosts,
  listProfilePosts,
  MAX_DRAFTS,
  publishOwnPost,
  searchPostIds,
  updateOwnPost,
} from "@/server/modules/content";

import { resetDatabase } from "../helpers/database";
import { actorFor, createMedia, createPost, createSkill, createUser } from "../helpers/factories";
import { createFakeMediaProvider } from "../helpers/fake-media";

// Makers' own posts (roadmap P2-02; CRT-01…13, API_SPECIFICATION §9.1): drafts for everyone,
// Share with a verified email and the own-work confirmation, only own media, 404 for others.

const provider = createFakeMediaProvider();
const options = { provider };

async function maker(overrides: { emailVerified?: Date | null } = {}) {
  const user = await createUser(overrides);
  await db.profile.create({
    data: { userId: user.id, username: `maker${user.id.slice(-6)}`, displayName: "Asha" },
  });
  return { user, actor: actorFor(user) };
}

/** A draft that meets every rule except the own-work confirmation. */
async function readyDraft(actor: AuthenticatedActor, extra: { type?: "TUTORIAL" } = {}) {
  const skill = await createSkill(`Skill ${Math.random().toString(36).slice(2, 8)}`);
  const photo = await createMedia({ ownerId: actor.id });
  return createOwnPost(
    actor,
    {
      type: extra.type ?? "FIRST_ATTEMPT",
      title: "My first pinch pot",
      description: "Wobbly but mine.",
      skillIds: [skill.id],
      primarySkillId: skill.id,
      mediaIds: [photo.id],
      tags: ["#Air Dry", "air dry", "clay"],
      difficulty: null,
      estimatedMinutes: null,
      materials: [],
      steps: [],
      projectId: null,
    },
    options,
  );
}

describe("own posts", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await resetDatabase();
    await db.$disconnect();
  });

  it("creates a draft from the first upload with defaults, listed under Drafts", async () => {
    const { actor } = await maker();
    const photo = await createMedia({ ownerId: actor.id });

    const draft = await createOwnPost(
      actor,
      {
        type: "FIRST_ATTEMPT",
        title: "Untitled",
        skillIds: [],
        primarySkillId: null,
        mediaIds: [photo.id],
        tags: [],
        difficulty: null,
        estimatedMinutes: null,
        materials: [],
        steps: [],
        projectId: null,
      },
      options,
    );

    expect(draft).toMatchObject({ status: "DRAFT", title: "Untitled", ownWorkConfirmed: false });
    expect(draft.media.map((item) => item.id)).toEqual([photo.id]);
    const drafts = await listOwnPosts(actor, { status: "DRAFT", limit: 20 }, options);
    expect(drafts.items.map((item) => item.id)).toEqual([draft.id]);
    expect(drafts.items[0]?.coverMedia?.id).toBe(photo.id);
  });

  it("stores tags lowercased without # or duplicates, and refuses bad tags", async () => {
    const { actor } = await maker();
    const draft = await readyDraft(actor);
    expect(draft.tags).toEqual(["air dry", "clay"]);

    await expect(updateOwnPost(actor, draft.id, { tags: ["x"] }, options)).rejects.toMatchObject({
      status: 400,
      fields: { tags: expect.any(String) },
    });
    await expect(updateOwnPost(actor, draft.id, { tags: ["fuck"] }, options)).rejects.toMatchObject(
      { status: 400, fields: { tags: "Please choose another tag." } },
    );
  });

  it("only accepts the maker's own uploads and active skills", async () => {
    const { actor } = await maker();
    const draft = await readyDraft(actor);
    const someoneElses = await createMedia({ ownerId: (await createUser()).id });
    const hidden = await createSkill("Hidden craft", { status: "HIDDEN" });

    await expect(
      updateOwnPost(actor, draft.id, { mediaIds: [someoneElses.id] }, options),
    ).rejects.toMatchObject({ status: 400, fields: { mediaIds: expect.any(String) } });
    await expect(
      updateOwnPost(actor, draft.id, { skillIds: [hidden.id], primarySkillId: hidden.id }, options),
    ).rejects.toMatchObject({ status: 400, fields: { skillIds: expect.any(String) } });
  });

  it("shares only with the own-work confirmation, then asks for it never again", async () => {
    const { actor } = await maker();
    const draft = await readyDraft(actor);

    await expect(
      publishOwnPost(actor, draft.id, { ownWorkConfirmed: false }, options),
    ).rejects.toMatchObject({
      status: 400,
      code: "POST_NOT_PUBLISHABLE",
      fields: { ownWorkConfirmed: expect.any(String) },
    });

    const published = await publishOwnPost(actor, draft.id, { ownWorkConfirmed: true }, options);
    expect(published).toMatchObject({ status: "PUBLISHED", ownWorkConfirmed: true });
    expect(published.publishedAt).not.toBeNull();

    const detail = await getPostDetail(null, draft.id, options);
    expect(detail.creator?.displayName).toBe("Asha");
    expect(detail.attribution).toBeNull();
  });

  it("needs two steps and a time for a tutorial", async () => {
    const { actor } = await maker();
    const draft = await readyDraft(actor, { type: "TUTORIAL" });

    await expect(
      publishOwnPost(actor, draft.id, { ownWorkConfirmed: true }, options),
    ).rejects.toMatchObject({
      fields: { steps: expect.any(String), estimatedMinutes: expect.any(String) },
    });

    await updateOwnPost(
      actor,
      draft.id,
      { steps: [{ text: "Pinch" }, { text: "Smooth" }], estimatedMinutes: 40 },
      options,
    );
    await expect(
      publishOwnPost(actor, draft.id, { ownWorkConfirmed: true }, options),
    ).resolves.toMatchObject({ status: "PUBLISHED" });
  });

  it("needs a verified email to share, but not to write drafts", async () => {
    const { actor } = await maker({ emailVerified: null });
    const draft = await readyDraft(actor);

    await expect(
      publishOwnPost(actor, draft.id, { ownWorkConfirmed: true }, options),
    ).rejects.toMatchObject({ status: 403, code: "EMAIL_NOT_VERIFIED" });
  });

  it("keeps a published post publishable when it is edited", async () => {
    const { actor } = await maker();
    const draft = await readyDraft(actor);
    await publishOwnPost(actor, draft.id, { ownWorkConfirmed: true }, options);

    await expect(updateOwnPost(actor, draft.id, { mediaIds: [] }, options)).rejects.toMatchObject({
      code: "POST_NOT_PUBLISHABLE",
    });
    const updated = await updateOwnPost(actor, draft.id, { title: "Pinch pot, glazed" }, options);
    expect(updated.title).toBe("Pinch pot, glazed");
  });

  it("answers 404 for other people's posts and invited creators' seeded posts", async () => {
    const { actor } = await maker();
    const other = await maker();
    const draft = await readyDraft(other.actor);
    const seeded = await createPost({ authorId: actor.id, sourceType: "INVITED_CREATOR" });

    await expect(getOwnPost(actor, draft.id, options)).rejects.toMatchObject({ status: 404 });
    await expect(updateOwnPost(actor, seeded.id, { title: "Mine" }, options)).rejects.toMatchObject(
      { status: 404 },
    );
    await expect(deleteOwnPost(actor, draft.id, options)).rejects.toMatchObject({ status: 404 });
    expect((await listOwnPosts(actor, { limit: 20 }, options)).items).toEqual([]);
  });

  it("lets the author preview a draft that nobody else can open", async () => {
    const { actor } = await maker();
    const draft = await readyDraft(actor);

    await expect(getPostDetail(actor, draft.id, options)).resolves.toMatchObject({ id: draft.id });
    await expect(
      getPostDetail(actorFor(await createUser()), draft.id, options),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("deletes the post with its saves and its unused media", async () => {
    const { actor } = await maker();
    const draft = await readyDraft(actor);
    await publishOwnPost(actor, draft.id, { ownWorkConfirmed: true }, options);
    const fan = await createUser();
    await db.save.create({ data: { userId: fan.id, postId: draft.id } });
    const mediaId = draft.media[0]?.id ?? "";

    await deleteOwnPost(actor, draft.id, options);

    expect(await db.post.count({ where: { id: draft.id } })).toBe(0);
    expect(await db.save.count({ where: { postId: draft.id } })).toBe(0);
    expect(await db.mediaAsset.count({ where: { id: mediaId } })).toBe(0);
  });

  it("finds shared posts by tag, keeps them out of the maker's own feed, and lists them on the profile", async () => {
    const { actor } = await maker();
    const draft = await readyDraft(actor);
    await publishOwnPost(actor, draft.id, { ownWorkConfirmed: true }, options);

    expect(await searchPostIds(["clay"], "clay", { offset: 0, take: 10 })).toContain(draft.id);
    const forMaker = await getFeedCandidates({
      excludeIds: [],
      excludeAuthorId: actor.id,
      take: 50,
    });
    const forOthers = await getFeedCandidates({
      excludeIds: [],
      excludeAuthorId: "someone",
      take: 50,
    });
    expect(forMaker.map((post) => post.id)).not.toContain(draft.id);
    expect(forOthers.map((post) => post.id)).toContain(draft.id);

    const profile = await db.profile.findUniqueOrThrow({ where: { userId: actor.id } });
    const viewer = actorFor(await createUser());
    const page = await listProfilePosts(viewer, profile.username, { limit: 20 }, options);
    expect(page.items.map((item) => item.id)).toEqual([draft.id]);
  });

  it("limits drafts to 50 and shares to 20 a day", async () => {
    const { user, actor } = await maker();
    await db.post.createMany({
      data: Array.from({ length: MAX_DRAFTS }, (_, index) => ({
        type: "FIRST_ATTEMPT" as const,
        title: `Draft ${index}`,
        authorId: user.id,
      })),
    });
    await expect(readyDraft(actor)).rejects.toMatchObject({ status: 422, code: "DRAFT_LIMIT" });

    await db.post.deleteMany({ where: { authorId: user.id } });
    const drafts = [];
    for (let index = 0; index < 21; index += 1) drafts.push(await readyDraft(actor));
    for (const draft of drafts.slice(0, 20)) {
      await publishOwnPost(actor, draft.id, { ownWorkConfirmed: true }, options);
    }
    await expect(
      publishOwnPost(actor, drafts[20]?.id ?? "", { ownWorkConfirmed: true }, options),
    ).rejects.toBeInstanceOf(RateLimitError);
  });
});
