import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/server/db/client";
import { blockUser } from "@/server/modules/blocks";
import { followUser } from "@/server/modules/follows";
import {
  listMessagePeople,
  MESSAGE_PEOPLE_RATE_LIMIT,
  sendMessage,
  startConversation,
} from "@/server/modules/messages";
import { updateMessageSettings } from "@/server/modules/users";

import { resetDatabase } from "../helpers/database";
import { actorFor, createUser } from "../helpers/factories";

// Find people to message (roadmap P3-06; MSG-06, USER_FLOWS F-29 step 1b): the list holds only
// members the caller could write to, with the same rules as starting a conversation, and never
// says why someone is missing.

let counter = 0;

async function member(
  options: {
    verified?: boolean;
    name?: string;
    username?: string;
    visibility?: "PUBLIC" | "PRIVATE";
    isHidden?: boolean;
  } = {},
) {
  counter += 1;
  const user = await createUser({ emailVerified: options.verified === false ? null : new Date() });
  const profile = await db.profile.create({
    data: {
      userId: user.id,
      username: options.username ?? `pp${counter}x${user.id.slice(-6)}`,
      displayName: options.name ?? "Asha",
      visibility: options.visibility ?? "PUBLIC",
      isHidden: options.isHidden ?? false,
    },
  });
  return { actor: actorFor(user), userId: user.id, username: profile.username };
}

type Who = Awaited<ReturnType<typeof member>>;

async function usernames(who: Who, q = "") {
  const page = await listMessagePeople(who.actor, q ? { q } : {});
  return page.items.map((person) => person.username);
}

describe("people to message", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await resetDatabase();
    await db.$disconnect();
  });

  it("is for verified members only", async () => {
    const newcomer = await member({ verified: false });
    await expect(listMessagePeople(newcomer.actor, {})).rejects.toMatchObject({
      status: 403,
      code: "EMAIL_NOT_VERIFIED",
    });
    await expect(listMessagePeople(null, {})).rejects.toMatchObject({ status: 401 });
  });

  it("finds people by username or a word of the display name, never yourself", async () => {
    const asha = await member({ name: "Zed Maker", username: "zed-maker" });
    const ravi = await member({ name: "Ravi Kumar", username: "ravik" });

    expect(await usernames(asha, "ravi")).toEqual([ravi.username]);
    expect(await usernames(asha, "kumar")).toEqual([ravi.username]);
    expect(await usernames(asha, "ravik")).toEqual([ravi.username]);
    expect(await usernames(asha, "zed")).toEqual([]);
  });

  it("leaves out blocks either way, private, hidden and deactivated profiles", async () => {
    const asha = await member({ name: "Searcher" });
    const blockedByAsha = await member({ name: "Mina Blocked" });
    const blocksAsha = await member({ name: "Mina Blocker" });
    await member({ name: "Mina Private", visibility: "PRIVATE" });
    await member({ name: "Mina Hidden", isHidden: true });
    const gone = await member({ name: "Mina Gone" });
    const fine = await member({ name: "Mina Fine" });
    await blockUser(asha.actor, blockedByAsha.username);
    await blockUser(blocksAsha.actor, asha.username);
    await db.user.update({ where: { id: gone.userId }, data: { deletionRequestedAt: new Date() } });

    expect(await usernames(asha, "mina")).toEqual([fine.username]);
  });

  it("respects who can message me, with the exception for someone who already wrote", async () => {
    const asha = await member({ name: "Searcher" });
    const open = await member({ name: "Kiran Open" });
    const nobody = await member({ name: "Kiran Nobody" });
    const followsOnly = await member({ name: "Kiran Follows" });
    const followsAndFollowed = await member({ name: "Kiran Mutual" });
    await updateMessageSettings(nobody.actor, { messagePolicy: "NOBODY" });
    await updateMessageSettings(followsOnly.actor, { messagePolicy: "FOLLOWING" });
    await updateMessageSettings(followsAndFollowed.actor, { messagePolicy: "FOLLOWING" });
    await followUser(followsAndFollowed.actor, asha.username);

    expect((await usernames(asha, "kiran")).sort()).toEqual(
      [open.username, followsAndFollowed.username].sort(),
    );

    // Someone who closed messages but wrote to Asha first can still be answered, so they are listed.
    const { id } = await startConversation(nobody.actor, { username: asha.username });
    await sendMessage(nobody.actor, id, { body: "Hi Asha" });
    expect(await usernames(asha, "kiran")).toContain(nobody.username);
  });

  it("returns the existing conversation id so the screen does not create one", async () => {
    const asha = await member({ name: "Searcher" });
    const ravi = await member({ name: "Ravi Open" });
    const meera = await member({ name: "Ravi Other" });
    const { id } = await startConversation(asha.actor, { username: ravi.username });

    const page = await listMessagePeople(asha.actor, { q: "ravi" });
    const byName = Object.fromEntries(page.items.map((p) => [p.username, p.conversationId]));
    expect(byName[ravi.username]).toBe(id);
    expect(byName[meera.username]).toBeNull();
  });

  it("suggests people you follow and who follow you, by name, under the same rules", async () => {
    const asha = await member({ name: "Searcher" });
    const followed = await member({ name: "Bela Followed" });
    const follower = await member({ name: "Adi Follower" });
    const stranger = await member({ name: "Cara Stranger" });
    const closed = await member({ name: "Dev Closed" });
    const blocked = await member({ name: "Eli Blocked" });
    await updateMessageSettings(closed.actor, { messagePolicy: "NOBODY" });
    await followUser(asha.actor, followed.username);
    await followUser(follower.actor, asha.username);
    await followUser(asha.actor, closed.username);
    await followUser(asha.actor, blocked.username);
    await blockUser(asha.actor, blocked.username);

    expect(await usernames(asha)).toEqual([follower.username, followed.username]);
    expect(await usernames(asha)).not.toContain(stranger.username);
  });

  it("pages searches and keeps pages full when some matches are filtered out", async () => {
    const asha = await member({ name: "Searcher" });
    const names: string[] = [];
    for (let i = 0; i < 30; i += 1) {
      const person = await member({ name: `Tara ${String(i).padStart(2, "0")}` });
      if (i % 5 === 0) await updateMessageSettings(person.actor, { messagePolicy: "NOBODY" });
      else names.push(person.username);
    }

    const first = await listMessagePeople(asha.actor, { q: "tara" });
    expect(first.items).toHaveLength(20);
    expect(first.nextCursor).not.toBeNull();
    const second = await listMessagePeople(asha.actor, {
      q: "tara",
      cursor: first.nextCursor ?? undefined,
    });
    expect(second.items).toHaveLength(4);
    expect(second.nextCursor).toBeNull();
    expect([...first.items, ...second.items].map((person) => person.username).sort()).toEqual(
      [...names].sort(),
    );
  });

  it("is rate limited to 60 a minute", async () => {
    const asha = await member();
    for (let i = 0; i < MESSAGE_PEOPLE_RATE_LIMIT.limit; i += 1) {
      await listMessagePeople(asha.actor, {});
    }
    await expect(listMessagePeople(asha.actor, {})).rejects.toMatchObject({ status: 429 });
  });
});
