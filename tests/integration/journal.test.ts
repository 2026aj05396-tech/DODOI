import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/server/db/client";
import { createOwnPost } from "@/server/modules/content";
import {
  addEntry,
  checkMaterial,
  createProject,
  deleteEntry,
  deleteProject,
  getProject,
  isOwnProject,
  listMyProjects,
  listProfileProjects,
  startProjectFromPost,
  updateEntry,
  updateProject,
} from "@/server/modules/journal";

import { resetDatabase } from "../helpers/database";
import { actorFor, createMedia, createPost, createSkill, createUser } from "../helpers/factories";
import { createFakeMediaProvider } from "../helpers/fake-media";

// Creative journal (roadmap P2-03; JRN-01…07, API_SPECIFICATION §9.1): private by default, public
// projects readable by others, entries with the maker's own photos, "Start as my project".

async function maker(overrides: { emailVerified?: Date | null } = {}) {
  const user = await createUser(overrides);
  await db.profile.create({
    data: { userId: user.id, username: `jr${user.id.slice(-8)}`, displayName: "Meera" },
  });
  return actorFor(user);
}

describe("journal", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await resetDatabase();
    await db.$disconnect();
  });

  it("creates a private project in progress that nobody else can open", async () => {
    const owner = await maker();
    const skill = await createSkill("Embroidery");

    const project = await createProject(owner, {
      title: "My first embroidered flower",
      skillId: skill.id,
      visibility: "PRIVATE",
    });

    expect(project).toMatchObject({
      status: "IN_PROGRESS",
      visibility: "PRIVATE",
      isOwner: true,
      entryCount: 0,
      skill: { name: "Embroidery" },
    });
    await expect(getProject(await maker(), project.id)).rejects.toMatchObject({ status: 404 });
    await expect(getProject(null, project.id)).rejects.toMatchObject({ status: 401 });
  });

  it("shows a public project to others and on the profile; private ones only to the owner", async () => {
    const owner = await maker();
    const visitor = await maker();
    const shared = await createProject(owner, {
      title: "Shared",
      skillId: null,
      visibility: "PUBLIC",
    });
    await createProject(owner, { title: "Secret", skillId: null, visibility: "PRIVATE" });
    const username = (await db.profile.findUniqueOrThrow({ where: { userId: owner.id } })).username;

    await expect(getProject(visitor, shared.id)).resolves.toMatchObject({ isOwner: false });
    expect((await listProfileProjects(visitor, username)).map((p) => p.title)).toEqual(["Shared"]);
    expect((await listProfileProjects(owner, username)).map((p) => p.title).sort()).toEqual([
      "Secret",
      "Shared",
    ]);
  });

  it("needs a verified email to make a project public", async () => {
    const owner = await maker({ emailVerified: null });
    const project = await createProject(owner, {
      title: "Draft idea",
      skillId: null,
      visibility: "PRIVATE",
    });

    await expect(updateProject(owner, project.id, { visibility: "PUBLIC" })).rejects.toMatchObject({
      status: 403,
      code: "EMAIL_NOT_VERIFIED",
    });
  });

  it("adds entries newest first, numbered from the first, with the maker's own photos only", async () => {
    const owner = await maker();
    const project = await createProject(owner, {
      title: "Hoop",
      skillId: null,
      visibility: "PRIVATE",
    });
    const mine = await createMedia({ ownerId: owner.id });
    const theirs = await createMedia({ ownerId: (await createUser()).id });

    await addEntry(owner, project.id, {
      title: "Choosing materials",
      body: "Cotton.",
      mediaIds: [],
    });
    const after = await addEntry(owner, project.id, {
      title: "Finished the petals!",
      body: null,
      mediaIds: [mine.id],
    });

    expect(after.entries.map((entry) => [entry.number, entry.title])).toEqual([
      [2, "Finished the petals!"],
      [1, "Choosing materials"],
    ]);
    expect(after.entries[0]?.media.map((media) => media.id)).toEqual([mine.id]);
    expect(after.coverMedia?.id).toBe(mine.id);
    await expect(
      addEntry(owner, project.id, { title: null, body: "x", mediaIds: [theirs.id] }),
    ).rejects.toMatchObject({ status: 400, fields: { mediaIds: expect.any(String) } });
    await expect(
      addEntry(await maker(), project.id, { title: null, body: "x", mediaIds: [] }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("edits and deletes entries, removing photos nothing else uses", async () => {
    const provider = createFakeMediaProvider();
    const owner = await maker();
    const project = await createProject(owner, {
      title: "P",
      skillId: null,
      visibility: "PRIVATE",
    });
    const first = await createMedia({ ownerId: owner.id });
    const second = await createMedia({ ownerId: owner.id });
    const withEntry = await addEntry(owner, project.id, {
      title: null,
      body: "Day one",
      mediaIds: [first.id],
    });
    const entryId = withEntry.entries[0]?.id ?? "";

    const edited = await updateEntry(
      owner,
      project.id,
      entryId,
      { body: "Day one, again", mediaIds: [second.id] },
      { provider },
    );
    expect(edited.entries[0]).toMatchObject({ body: "Day one, again" });
    expect(await db.mediaAsset.count({ where: { id: first.id } })).toBe(0);

    await deleteEntry(owner, project.id, entryId, { provider });
    expect((await getProject(owner, project.id)).entries).toEqual([]);
    expect(await db.mediaAsset.count({ where: { id: second.id } })).toBe(0);
  });

  it("completes and reopens a project", async () => {
    const owner = await maker();
    const project = await createProject(owner, {
      title: "P",
      skillId: null,
      visibility: "PRIVATE",
    });

    const done = await updateProject(owner, project.id, { status: "COMPLETED" });
    expect(done.status).toBe("COMPLETED");
    expect(done.completedAt).not.toBeNull();
    const reopened = await updateProject(owner, project.id, { status: "IN_PROGRESS" });
    expect(reopened.completedAt).toBeNull();
    expect((await listMyProjects(owner, { status: "COMPLETED" })).length).toBe(0);
  });

  it("starts a project from a tutorial with its materials as a checklist", async () => {
    const owner = await maker();
    const skill = await createSkill("Crochet");
    const tutorial = await createPost({
      title: "Your first granny square",
      skills: [{ id: skill.id }],
      materials: ["4 mm hook", "Cotton yarn"],
      steps: ["Magic ring", "Chain three"],
    });

    const project = await startProjectFromPost(owner, tutorial.id);

    expect(project).toMatchObject({
      title: "Your first granny square",
      visibility: "PRIVATE",
      skill: { name: "Crochet" },
      sourcePost: { id: tutorial.id, title: "Your first granny square" },
    });
    expect(project.materials.map((material) => [material.name, material.checked])).toEqual([
      ["4 mm hook", false],
      ["Cotton yarn", false],
    ]);

    const hook = project.materials[0]?.id ?? "";
    await checkMaterial(owner, project.id, hook, true);
    expect((await getProject(owner, project.id)).materials[0]?.checked).toBe(true);
    await expect(checkMaterial(await maker(), project.id, hook, false)).rejects.toMatchObject({
      status: 404,
    });
  });

  it("deletes a project with its entries and their photos", async () => {
    const provider = createFakeMediaProvider();
    const owner = await maker();
    const project = await createProject(owner, {
      title: "P",
      skillId: null,
      visibility: "PRIVATE",
    });
    const photo = await createMedia({ ownerId: owner.id });
    await addEntry(owner, project.id, { title: null, body: null, mediaIds: [photo.id] });

    await deleteProject(owner, project.id, { provider });

    expect(await db.project.count()).toBe(0);
    expect(await db.mediaAsset.count({ where: { id: photo.id } })).toBe(0);
  });

  it("links a post shared from a project back to it (JRN-05)", async () => {
    const owner = await maker();
    const project = await createProject(owner, { title: "P", skillId: null, visibility: "PUBLIC" });
    const photo = await createMedia({ ownerId: owner.id });

    expect(await isOwnProject(owner, project.id)).toBe(true);
    expect(await isOwnProject(await maker(), project.id)).toBe(false);
    const post = await createOwnPost(owner, {
      type: "WORK_IN_PROGRESS",
      title: "Halfway",
      skillIds: [],
      primarySkillId: null,
      mediaIds: [photo.id],
      tags: [],
      difficulty: null,
      estimatedMinutes: null,
      materials: [],
      steps: [],
      projectId: project.id,
    });

    expect((await db.post.findUniqueOrThrow({ where: { id: post.id } })).projectId).toBe(
      project.id,
    );
  });
});
