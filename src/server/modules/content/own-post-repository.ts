import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db/client";

// Makers' own posts (P2-02): queries the admin repository doesn't cover — listing by author, tags
// and media ownership. Writes of the post itself go through the admin repository's helpers.
// "Own" means written by the maker: seeded posts of invited creators also have an author, but
// always an attribution row, and stay admin-managed.

const OWN = { attribution: { is: null } } satisfies Prisma.PostWhereInput;

type Tx = Prisma.TransactionClient;

const coverSelect = {
  orderBy: { position: "asc" },
  take: 1,
  select: {
    media: {
      select: {
        id: true,
        type: true,
        publicId: true,
        width: true,
        height: true,
        altText: true,
        durationSec: true,
      },
    },
  },
} as const;

/** The author's posts, newest change first. Unpublished posts are listed with the drafts. */
export async function findOwnPostSummaries(options: {
  authorId: string;
  status?: "DRAFT" | "PUBLISHED";
  after?: { updatedAt: Date; id: string };
  take: number;
}) {
  const { authorId, status, after, take } = options;
  return db.post.findMany({
    where: {
      authorId,
      ...OWN,
      AND: [
        // Posts hidden after a report are listed with the drafts, so their author can find them
        // to read the notice and delete them (MOD-04).
        ...(status === "PUBLISHED" ? [{ status: "PUBLISHED" as const, hiddenAt: null }] : []),
        ...(status === "DRAFT"
          ? [
              {
                OR: [
                  { status: { in: ["DRAFT", "UNPUBLISHED"] as ("DRAFT" | "UNPUBLISHED")[] } },
                  { hiddenAt: { not: null } },
                ],
              },
            ]
          : []),
        ...(after
          ? [
              {
                OR: [
                  { updatedAt: { lt: after.updatedAt } },
                  { updatedAt: after.updatedAt, id: { lt: after.id } },
                ],
              },
            ]
          : []),
      ],
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take,
    select: {
      id: true,
      status: true,
      type: true,
      title: true,
      hiddenAt: true,
      publishedAt: true,
      updatedAt: true,
      media: coverSelect,
    },
  });
}

export async function countDrafts(authorId: string): Promise<number> {
  return db.post.count({
    where: { authorId, ...OWN, status: { in: ["DRAFT", "UNPUBLISHED"] } },
  });
}

export async function findPostOwnership(id: string) {
  return db.post.findUnique({
    where: { id },
    select: { authorId: true, ownWorkConfirmedAt: true, attribution: { select: { postId: true } } },
  });
}

export async function findPostTagNames(postId: string, client: Tx | typeof db = db) {
  const rows = await client.postTag.findMany({
    where: { postId },
    orderBy: { tag: { name: "asc" } },
    select: { tag: { select: { name: true } } },
  });
  return rows.map((row) => row.tag.name);
}

/** Of `ids`, those uploaded by `ownerId`. */
export async function findOwnedMediaIds(ids: string[], ownerId: string): Promise<Set<string>> {
  const rows = await db.mediaAsset.findMany({
    where: { id: { in: ids }, ownerId },
    select: { id: true },
  });
  return new Set(rows.map((row) => row.id));
}

/** Replaces the post's tags, creating tags not seen before (one row per normalised name). */
export async function replacePostTags(
  postId: string,
  tags: { name: string; normalizedName: string }[],
  tx: Tx,
): Promise<void> {
  await tx.postTag.deleteMany({ where: { postId } });
  for (const tag of tags) {
    const row = await tx.tag.upsert({
      where: { normalizedName: tag.normalizedName },
      create: tag,
      update: {},
      select: { id: true },
    });
    await tx.postTag.create({ data: { postId, tagId: row.id } });
  }
}

/** Links a post to the journal project it was shared from (JRN-05). */
export async function setPostProject(id: string, projectId: string, tx: Tx): Promise<void> {
  await tx.post.update({ where: { id }, data: { projectId } });
}

export async function setOwnWorkConfirmed(id: string, tx: Tx): Promise<void> {
  await tx.post.update({ where: { id }, data: { ownWorkConfirmedAt: new Date() } });
}

/** Published posts by `authorId`, newest first (profile Posts tab). */
export async function findPublishedPostIdsByAuthor(options: {
  authorId: string;
  after?: { publishedAt: Date; id: string };
  take: number;
}): Promise<{ id: string; publishedAt: Date | null }[]> {
  const { authorId, after, take } = options;
  return db.post.findMany({
    where: {
      authorId,
      status: "PUBLISHED",
      media: { some: {} },
      ...(after
        ? {
            OR: [
              { publishedAt: { lt: after.publishedAt } },
              { publishedAt: after.publishedAt, id: { lt: after.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    take,
    select: { id: true, publishedAt: true },
  });
}
