import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { getActor } from "@/server/auth";
import { db } from "@/server/db/client";
import type { AuthenticatedActor } from "@/server/lib/actor";
import { registerMedia, signMediaUpload } from "@/server/modules/content";
import {
  addToCollection,
  createCollection,
  getMyProfile,
  getProfile,
  updateMyProfile,
} from "@/server/modules/library";

import * as profileRoute from "../../src/app/api/profiles/[username]/route";
import { resetDatabase } from "../helpers/database";
import { actorFor, createCreator, createPost, createSkill } from "../helpers/factories";
import { createFakeMediaProvider } from "../helpers/fake-media";

// Profiles and avatars (roadmap P1-13/P1-12; PRF-01…08, OD-10, OD-11): username rules, private
// and hidden profiles, no private fields, own avatars only.

vi.mock("@/server/auth", () => ({ getActor: vi.fn() }));
const mockedGetActor = vi.mocked(getActor);
const provider = createFakeMediaProvider();
const options = { provider };

/** A user with a profile (username `creator-N`). */
async function member(): Promise<AuthenticatedActor> {
  return actorFor(await createCreator());
}

async function usernameOf(actor: AuthenticatedActor): Promise<string> {
  return (await db.profile.findUniqueOrThrow({ where: { userId: actor.id } })).username;
}

async function uploadAvatar(actor: AuthenticatedActor, name: string) {
  const signed = await signMediaUpload(
    actor,
    { purpose: "avatar", type: "IMAGE", bytes: 200_000, mimeType: "image/jpeg" },
    options,
  );
  const publicId = `${signed.folder}/${name}`;
  provider.assets.set(publicId, {
    publicId,
    resourceType: "image",
    format: "jpg",
    bytes: 200_000,
    width: 800,
    height: 800,
    durationSec: null,
  });
  return registerMedia(actor, { purpose: "avatar", type: "IMAGE", publicId }, options);
}

describe("profiles", () => {
  beforeEach(async () => {
    await resetDatabase();
    mockedGetActor.mockReset();
  });

  afterAll(async () => {
    await resetDatabase();
  });

  it("edits name, bio and privacy; an empty bio is cleared", async () => {
    const actor = await member();

    const updated = await updateMyProfile(
      actor,
      { displayName: "Aanya Sharma", bio: "Watercolor most evenings.", visibility: "PRIVATE" },
      options,
    );
    expect(updated).toMatchObject({
      displayName: "Aanya Sharma",
      bio: "Watercolor most evenings.",
      visibility: "PRIVATE",
      avatar: null,
      usernameChangeAvailableAt: null,
    });
    expect((await updateMyProfile(actor, { bio: null }, options)).bio).toBeNull();
  });

  it("changes the username once per 30 days and refuses taken, reserved or offensive ones", async () => {
    const actor = await member();
    const other = await member();

    const changed = await updateMyProfile(actor, { username: "aanya_makes" }, options);
    expect(changed.username).toBe("aanya_makes");
    expect(changed.usernameChangeAvailableAt).not.toBeNull();

    await expect(updateMyProfile(actor, { username: "aanya-2" }, options)).rejects.toMatchObject({
      status: 422,
      code: "USERNAME_CHANGE_TOO_SOON",
    });
    // Sending the current username again is not a change.
    await expect(
      updateMyProfile(actor, { username: "aanya_makes" }, options),
    ).resolves.toBeTruthy();

    await expect(
      updateMyProfile(other, { username: "aanya_makes" }, options),
    ).rejects.toMatchObject({ status: 409, code: "USERNAME_TAKEN" });
    await expect(updateMyProfile(other, { username: "settings" }, options)).rejects.toMatchObject({
      status: 400,
      fields: { username: "That username is reserved. Try another." },
    });
    await expect(updateMyProfile(other, { username: "shit_maker" }, options)).rejects.toMatchObject(
      { status: 400, fields: { username: "Please choose a different username." } },
    );
    await expect(
      updateMyProfile(other, { displayName: "Total bastard" }, options),
    ).rejects.toMatchObject({ fields: { displayName: "Please choose a different name." } });

    await db.profile.update({
      where: { userId: actor.id },
      data: { usernameChangedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000) },
    });
    expect((await updateMyProfile(actor, { username: "aanya-2" }, options)).username).toBe(
      "aanya-2",
    );
  });

  it("lets any user upload their own avatar, but not use someone else's", async () => {
    const actor = await member();
    const other = await member();
    const avatar = await uploadAvatar(actor, "aanya");
    const othersAvatar = await uploadAvatar(other, "ravi");

    const updated = await updateMyProfile(actor, { avatarMediaId: avatar.id }, options);
    expect(updated.avatar?.id).toBe(avatar.id);
    await expect(
      updateMyProfile(actor, { avatarMediaId: othersAvatar.id }, options),
    ).rejects.toMatchObject({ status: 400, fields: { avatarMediaId: expect.any(String) } });
    await expect(
      signMediaUpload(
        actor,
        { purpose: "post", type: "IMAGE", bytes: 1000, mimeType: "image/jpeg" },
        options,
      ),
    ).rejects.toMatchObject({ status: 404 });
    expect((await getMyProfile(actor, options)).avatar?.id).toBe(avatar.id);
  });

  it("shows skills and public collections, never private fields", async () => {
    const owner = await member();
    const visitor = await member();
    const crochet = await createSkill("Crochet");
    const pottery = await createSkill("Pottery");
    await db.userSkill.createMany({
      data: [
        {
          userId: owner.id,
          skillId: crochet.id,
          isInterest: true,
          canHelp: true,
          level: "BEGINNER",
        },
        { userId: owner.id, skillId: pottery.id, wantsToLearn: true },
      ],
    });
    const post = await createPost();
    const shared = await createCollection(owner, { name: "Shared", visibility: "PUBLIC" });
    await createCollection(owner, { name: "Secret", visibility: "PRIVATE" });
    await addToCollection(owner, shared.id, post.id);

    const view = await getProfile(visitor, await usernameOf(owner), options);

    expect(view).toMatchObject({
      isPrivate: false,
      isOwner: false,
      skills: {
        interests: [{ skill: { name: "Crochet" }, level: "BEGINNER" }],
        canHelp: [{ skill: { name: "Crochet" } }],
        wantsToLearn: [{ skill: { name: "Pottery" }, level: null }],
      },
    });
    expect(view.isPrivate ? [] : view.publicCollections.map((item) => item.name)).toEqual([
      "Shared",
    ]);
    const json = JSON.stringify(view);
    expect(json).not.toContain("@example.test");
    expect(json).not.toContain(owner.id);
  });

  it("shows a private profile's basics to others and everything to its owner", async () => {
    const owner = await member();
    const visitor = await member();
    await updateMyProfile(owner, { visibility: "PRIVATE", bio: "Secret bio" }, options);
    const username = await usernameOf(owner);

    expect(await getProfile(visitor, username, options)).toEqual({
      isPrivate: true,
      username,
      displayName: expect.any(String),
      avatarUrl: null,
    });
    expect(await getProfile(owner, username, options)).toMatchObject({
      isPrivate: false,
      isOwner: true,
      visibility: "PRIVATE",
      bio: "Secret bio",
    });
  });

  it("hides hidden and deactivated profiles from others; needs sign-in", async () => {
    const hidden = actorFor(await createCreator({ isHidden: true }));
    const gone = actorFor(await createCreator({ deactivated: true }));
    const visitor = await member();

    await expect(getProfile(visitor, await usernameOf(hidden), options)).rejects.toMatchObject({
      status: 404,
    });
    await expect(getProfile(visitor, await usernameOf(gone), options)).rejects.toMatchObject({
      status: 404,
    });
    await expect(getProfile(hidden, await usernameOf(hidden), options)).resolves.toMatchObject({
      isOwner: true,
    });
    await expect(getProfile(visitor, "nobody-here", options)).rejects.toMatchObject({
      status: 404,
    });

    mockedGetActor.mockResolvedValue(null);
    const response = await profileRoute.GET(
      new NextRequest("http://localhost:3000/api/profiles/someone"),
      { params: Promise.resolve({ username: "someone" }) },
    );
    expect(response.status).toBe(401);
  });
});
