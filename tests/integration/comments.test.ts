import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/server/db/client";
import {
  COMMENT_RATE_LIMIT,
  createComment,
  deleteComment,
  deleteCommentsOfUser,
  getCommentCount,
  listComments,
  listReplies,
  updateComment,
} from "@/server/modules/comments";

import { resetDatabase } from "../helpers/database";
import { actorFor, createPost, createUser } from "../helpers/factories";

// Comments (roadmap P2-04; CMT-01…05, OD-25, API_SPECIFICATION §9.1): one level of replies, soft
// delete when replies exist, the post's author can delete any comment, 30 comments an hour.

async function member(overrides: { emailVerified?: Date | null } = {}) {
  const user = await createUser(overrides);
  await db.profile.create({
    data: { userId: user.id, username: `cm${user.id.slice(-8)}`, displayName: "Asha" },
  });
  return actorFor(user);
}

describe("comments", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await resetDatabase();
    await db.$disconnect();
  });

  it("lists comments oldest first with their first replies, and counts them publicly", async () => {
    const post = await createPost();
    const asha = await member();
    const first = await createComment(asha, post.id, { body: "First!" });
    const second = await createComment(asha, post.id, { body: "Second" });
    for (const text of ["r1", "r2", "r3", "r4"]) {
      await createComment(asha, post.id, { body: text, parentId: first.id });
    }

    const page = await listComments(asha, post.id, {});

    expect(page.items.map((c) => c.body)).toEqual(["First!", "Second"]);
    expect(page.items[0]).toMatchObject({ replyCount: 4, isOwn: true });
    expect(page.items[0]?.replies.map((r) => r.body)).toEqual(["r1", "r2", "r3"]);
    expect(page.items[1]?.id).toBe(second.id);
    expect(await getCommentCount(post.id)).toBe(6);

    const more = await listReplies(asha, first.id, {});
    expect(more.items.map((r) => r.body)).toEqual(["r1", "r2", "r3", "r4"]);
  });

  it("loads 20 at a time", async () => {
    const post = await createPost();
    const asha = await member();
    for (let i = 0; i < 21; i += 1) await createComment(asha, post.id, { body: `c${i}` });
    await db.rateLimitBucket.deleteMany();

    const first = await listComments(asha, post.id, {});
    expect(first.items).toHaveLength(20);
    expect(first.nextCursor).not.toBeNull();
    const second = await listComments(asha, post.id, { cursor: first.nextCursor ?? undefined });
    expect(second.items.map((c) => c.body)).toEqual(["c20"]);
    expect(second.nextCursor).toBeNull();
  });

  it("attaches a reply to a reply to the comment above it (one level)", async () => {
    const post = await createPost();
    const asha = await member();
    const top = await createComment(asha, post.id, { body: "Top" });
    const reply = await createComment(asha, post.id, { body: "Reply", parentId: top.id });
    const nested = await createComment(asha, post.id, { body: "@asha Nested", parentId: reply.id });

    expect(nested.parentId).toBe(top.id);
  });

  it("needs a signed-in, verified user and a published post", async () => {
    const post = await createPost();
    const draft = await createPost({ status: "DRAFT" });
    const unverified = await member({ emailVerified: null });
    const asha = await member();

    await expect(createComment(null, post.id, { body: "Hi" })).rejects.toMatchObject({
      status: 401,
    });
    await expect(listComments(null, post.id, {})).rejects.toMatchObject({ status: 401 });
    await expect(createComment(unverified, post.id, { body: "Hi" })).rejects.toMatchObject({
      status: 403,
      code: "EMAIL_NOT_VERIFIED",
    });
    await expect(unverified && listComments(unverified, post.id, {})).resolves.toBeDefined();
    await expect(createComment(asha, draft.id, { body: "Hi" })).rejects.toMatchObject({
      status: 404,
    });
  });

  it("does not attach a reply to a comment on another post", async () => {
    const [a, b] = [await createPost(), await createPost()];
    const asha = await member();
    const onA = await createComment(asha, a.id, { body: "On A" });

    await expect(
      createComment(asha, b.id, { body: "Wrong post", parentId: onA.id }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("lets only the writer edit, and shows 'edited'", async () => {
    const post = await createPost();
    const asha = await member();
    const ravi = await member();
    const comment = await createComment(asha, post.id, { body: "Before" });

    const edited = await updateComment(asha, comment.id, "After");
    expect(edited).toMatchObject({ body: "After" });
    expect(edited.editedAt).not.toBeNull();
    await expect(updateComment(ravi, comment.id, "Hijack")).rejects.toMatchObject({ status: 404 });
  });

  it("deletes a comment without replies; keeps 'Comment deleted' when it has replies", async () => {
    const post = await createPost();
    const asha = await member();
    const ravi = await member();
    const lonely = await createComment(asha, post.id, { body: "Lonely" });
    const parent = await createComment(asha, post.id, { body: "Parent" });
    const reply = await createComment(ravi, post.id, { body: "Reply", parentId: parent.id });

    await deleteComment(asha, lonely.id);
    await deleteComment(asha, parent.id);

    const [kept] = (await listComments(ravi, post.id, {})).items;
    expect(kept).toMatchObject({ id: parent.id, body: null, isDeleted: true, author: null });
    expect(kept?.replies.map((r) => r.id)).toEqual([reply.id]);
    expect(await getCommentCount(post.id)).toBe(1);

    // The last reply going takes the empty "Comment deleted" with it.
    await deleteComment(ravi, reply.id);
    expect((await listComments(ravi, post.id, {})).items).toEqual([]);
  });

  it("lets the post's author delete any comment, but nobody else's", async () => {
    const maker = await member();
    const asha = await member();
    const ravi = await member();
    const post = await createPost({ authorId: maker.id });
    const comment = await createComment(asha, post.id, { body: "Nice" });

    const seenByMaker = (await listComments(maker, post.id, {})).items[0];
    const seenByRavi = (await listComments(ravi, post.id, {})).items[0];
    expect(seenByMaker?.canDelete).toBe(true);
    expect(seenByRavi?.canDelete).toBe(false);

    await expect(deleteComment(ravi, comment.id)).rejects.toMatchObject({ status: 404 });
    await deleteComment(maker, comment.id);
    expect(await getCommentCount(post.id)).toBe(0);
  });

  it("shows hidden comments only to their writer", async () => {
    const post = await createPost();
    const asha = await member();
    const ravi = await member();
    const comment = await createComment(asha, post.id, { body: "Reported" });
    await db.comment.update({ where: { id: comment.id }, data: { hiddenAt: new Date() } });

    expect((await listComments(asha, post.id, {})).items).toHaveLength(1);
    expect((await listComments(ravi, post.id, {})).items).toHaveLength(0);
    expect(await getCommentCount(post.id)).toBe(0);
  });

  it("allows 30 comments an hour", async () => {
    const post = await createPost();
    const asha = await member();
    for (let i = 0; i < COMMENT_RATE_LIMIT.limit; i += 1) {
      await createComment(asha, post.id, { body: `c${i}` });
    }
    await expect(createComment(asha, post.id, { body: "One too many" })).rejects.toMatchObject({
      status: 429,
    });
  });

  it("on account deletion removes the user's comments, keeping 'Comment deleted' for others' replies", async () => {
    const post = await createPost();
    const asha = await member();
    const ravi = await member();
    const withReplies = await createComment(asha, post.id, { body: "Mine, answered" });
    await createComment(asha, post.id, { body: "Mine, alone" });
    await createComment(ravi, post.id, { body: "Ravi's reply", parentId: withReplies.id });
    const ravisTop = await createComment(ravi, post.id, { body: "Ravi's comment" });
    await createComment(asha, post.id, { body: "Asha's reply", parentId: ravisTop.id });

    await db.$transaction((tx) => deleteCommentsOfUser(asha.id, tx));

    const items = (await listComments(ravi, post.id, {})).items;
    expect(items.map((c) => [c.body, c.isDeleted])).toEqual([
      [null, true],
      ["Ravi's comment", false],
    ]);
    expect(items[1]?.replyCount).toBe(0);
    expect(await db.comment.count({ where: { authorId: asha.id } })).toBe(0);
  });
});
