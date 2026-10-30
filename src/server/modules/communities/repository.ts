import "server-only";

import { Prisma, type CommunityRole } from "@/generated/prisma/client";
import { db } from "@/server/db/client";

// community, community_member, community_post, community_post_media and community_moderation_log
// tables (P3-01). Skills, people and media belong to other modules: only their ids are stored here.

type Tx = Prisma.TransactionClient;

const communitySelect = {
  id: true,
  name: true,
  slug: true,
  skillId: true,
  description: true,
  rules: true,
  createdById: true,
  hiddenAt: true,
  createdAt: true,
} satisfies Prisma.CommunitySelect;

export type CommunityRow = Prisma.CommunityGetPayload<{ select: typeof communitySelect }>;

export type CommunityPosition = { createdAt: Date; id: string };

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** Creates the community and its owner membership; null when the name or slug was taken meanwhile. */
export async function insertCommunity(data: {
  name: string;
  normalizedName: string;
  slug: string;
  skillId: string;
  description: string;
  rules: string[];
  createdById: string;
}): Promise<CommunityRow | null> {
  try {
    return await db.community.create({
      data: {
        ...data,
        members: { create: { userId: data.createdById, role: "OWNER" } },
      },
      select: communitySelect,
    });
  } catch (error) {
    if (isUniqueViolation(error)) return null;
    throw error;
  }
}

export async function findCommunityBySlug(slug: string): Promise<CommunityRow | null> {
  return db.community.findUnique({ where: { slug }, select: communitySelect });
}

export async function findCommunityById(id: string): Promise<CommunityRow | null> {
  return db.community.findUnique({ where: { id }, select: communitySelect });
}

export async function normalizedNameExists(normalizedName: string): Promise<boolean> {
  return (await db.community.count({ where: { normalizedName } })) > 0;
}

export async function slugExists(slug: string): Promise<boolean> {
  return (await db.community.count({ where: { slug } })) > 0;
}

export async function countOwnedCommunities(userId: string): Promise<number> {
  return db.communityMember.count({ where: { userId, role: "OWNER" } });
}

export async function findCommunities(options: {
  where: Prisma.CommunityWhereInput;
  after: CommunityPosition | null;
  take: number;
}): Promise<CommunityRow[]> {
  const { where, after, take } = options;
  return db.community.findMany({
    where: {
      ...where,
      ...(after
        ? {
            OR: [
              { createdAt: { lt: after.createdAt } },
              { createdAt: after.createdAt, id: { lt: after.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
    select: communitySelect,
  });
}

// --- Members ---------------------------------------------------------------------------------------

export type MemberRow = {
  userId: string;
  role: CommunityRole;
  removedAt: Date | null;
  joinedAt: Date;
};

export async function findMember(communityId: string, userId: string): Promise<MemberRow | null> {
  return db.communityMember.findUnique({
    where: { communityId_userId: { communityId, userId } },
    select: { userId: true, role: true, removedAt: true, joinedAt: true },
  });
}

/** The viewer's membership in each of the communities, removed ones included. */
export async function findMembershipsOf(
  userId: string,
  communityIds: string[],
): Promise<Map<string, MemberRow>> {
  if (communityIds.length === 0) return new Map();
  const rows = await db.communityMember.findMany({
    where: { userId, communityId: { in: communityIds } },
    select: { communityId: true, userId: true, role: true, removedAt: true, joinedAt: true },
  });
  return new Map(rows.map(({ communityId, ...member }) => [communityId, member]));
}

/** Adds a member; false when they already are one. */
export async function insertMember(communityId: string, userId: string): Promise<boolean> {
  const { count } = await db.communityMember.createMany({
    data: [{ communityId, userId }],
    skipDuplicates: true,
  });
  return count > 0;
}

export async function deleteMember(communityId: string, userId: string): Promise<void> {
  await db.communityMember.deleteMany({ where: { communityId, userId } });
}

export async function markMemberRemoved(communityId: string, userId: string): Promise<void> {
  await db.communityMember.update({
    where: { communityId_userId: { communityId, userId } },
    data: { removedAt: new Date(), role: "MEMBER" },
  });
}

export async function updateMemberRole(
  communityId: string,
  userId: string,
  role: CommunityRole,
): Promise<void> {
  await db.communityMember.update({
    where: { communityId_userId: { communityId, userId } },
    data: { role },
  });
}

/** Hands ownership over in one step: the old owner becomes a moderator. */
export async function transferOwnership(
  communityId: string,
  fromUserId: string,
  toUserId: string,
): Promise<void> {
  await db.$transaction([
    db.communityMember.update({
      where: { communityId_userId: { communityId, userId: fromUserId } },
      data: { role: "MODERATOR" },
    }),
    db.communityMember.update({
      where: { communityId_userId: { communityId, userId: toUserId } },
      data: { role: "OWNER" },
    }),
    db.community.update({ where: { id: communityId }, data: { createdById: toUserId } }),
  ]);
}

export async function countMembers(communityId: string): Promise<number> {
  return db.communityMember.count({ where: { communityId, removedAt: null } });
}

const ROLE_ORDER: CommunityRole[] = ["OWNER", "MODERATOR", "MEMBER"];

/** Current members (owner and moderators first, then newest) for the Manage sheet. */
export async function findMembersForManage(
  communityId: string,
  take: number,
): Promise<MemberRow[]> {
  const rows = await db.communityMember.findMany({
    where: { communityId, removedAt: null },
    orderBy: [{ joinedAt: "desc" }, { userId: "desc" }],
    select: { userId: true, role: true, removedAt: true, joinedAt: true },
  });
  return rows
    .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role))
    .slice(0, take);
}

export async function findRemovedMembers(communityId: string): Promise<MemberRow[]> {
  return db.communityMember.findMany({
    where: { communityId, removedAt: { not: null } },
    orderBy: { removedAt: "desc" },
    select: { userId: true, role: true, removedAt: true, joinedAt: true },
  });
}

// --- Posts -----------------------------------------------------------------------------------------

const postSelect = {
  id: true,
  communityId: true,
  authorId: true,
  parentId: true,
  body: true,
  hiddenAt: true,
  editedAt: true,
  createdAt: true,
  activityAt: true,
  photos: { select: { mediaId: true }, orderBy: { position: "asc" } },
} satisfies Prisma.CommunityPostSelect;

export type PostRow = Prisma.CommunityPostGetPayload<{ select: typeof postSelect }>;

export type PostPosition = { activityAt: Date; id: string };

/** Adds a post or reply; a reply also moves its post to the top of the list. */
export async function insertPost(data: {
  communityId: string;
  authorId: string;
  parentId: string | null;
  body: string;
  mediaIds: string[];
}): Promise<string> {
  const { mediaIds, ...fields } = data;
  return db.$transaction(async (tx: Tx) => {
    const row = await tx.communityPost.create({
      data: {
        ...fields,
        photos: { create: mediaIds.map((mediaId, position) => ({ mediaId, position })) },
      },
      select: { id: true, createdAt: true },
    });
    if (fields.parentId) {
      await tx.communityPost.update({
        where: { id: fields.parentId },
        data: { activityAt: row.createdAt },
      });
    }
    return row.id;
  });
}

export async function findPost(id: string): Promise<PostRow | null> {
  return db.communityPost.findUnique({ where: { id }, select: postSelect });
}

export async function findTopLevelPosts(options: {
  communityId: string;
  /** Hide hidden posts from everyone except these viewers' own and managers. */
  viewerId: string;
  isManager: boolean;
  excludeAuthorIds: string[];
  after: PostPosition | null;
  take: number;
}): Promise<PostRow[]> {
  const { communityId, viewerId, isManager, excludeAuthorIds, after, take } = options;
  const and: Prisma.CommunityPostWhereInput[] = [];
  if (!isManager) and.push({ OR: [{ hiddenAt: null }, { authorId: viewerId }] });
  if (excludeAuthorIds.length > 0) {
    and.push({ OR: [{ authorId: null }, { authorId: { notIn: excludeAuthorIds } }] });
  }
  if (after) {
    and.push({
      OR: [
        { activityAt: { lt: after.activityAt } },
        { activityAt: after.activityAt, id: { lt: after.id } },
      ],
    });
  }
  return db.communityPost.findMany({
    where: { communityId, parentId: null, AND: and },
    orderBy: [{ activityAt: "desc" }, { id: "desc" }],
    take,
    select: postSelect,
  });
}

export async function findRepliesOf(parentIds: string[]): Promise<PostRow[]> {
  if (parentIds.length === 0) return [];
  return db.communityPost.findMany({
    where: { parentId: { in: parentIds } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: postSelect,
  });
}

export async function updatePostBody(id: string, body: string): Promise<void> {
  await db.communityPost.update({ where: { id }, data: { body, editedAt: new Date() } });
}

export async function updatePostHidden(id: string, hidden: boolean): Promise<void> {
  await db.communityPost.update({ where: { id }, data: { hiddenAt: hidden ? new Date() : null } });
}

/** Deletes a post (its replies and photo links go with it) and returns the photo ids to clean up. */
export async function deletePostReturningMedia(id: string): Promise<string[]> {
  return db.$transaction(async (tx: Tx) => {
    const mediaIds = await mediaOfPosts(tx, { OR: [{ id }, { parentId: id }] });
    await tx.communityPost.delete({ where: { id } });
    return mediaIds;
  });
}

async function mediaOfPosts(tx: Tx, where: Prisma.CommunityPostWhereInput): Promise<string[]> {
  const rows = await tx.communityPostMedia.findMany({
    where: { post: where },
    select: { mediaId: true },
  });
  return rows.map((row) => row.mediaId);
}

/** Deletes a community with every discussion; returns the photo ids to clean up. */
export async function deleteCommunityReturningMedia(id: string): Promise<string[]> {
  return db.$transaction(async (tx: Tx) => {
    const mediaIds = await mediaOfPosts(tx, { communityId: id });
    await tx.community.delete({ where: { id } });
    return mediaIds;
  });
}

// --- Moderation log --------------------------------------------------------------------------------

export async function insertLog(data: {
  communityId: string;
  actorId: string;
  action: string;
  targetType: "post" | "member" | "community";
  targetId: string;
}): Promise<void> {
  await db.communityModerationLog.create({ data });
}

export async function findLog(communityId: string, take: number) {
  return db.communityModerationLog.findMany({
    where: { communityId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
    select: { id: true, actorId: true, action: true, targetType: true, createdAt: true },
  });
}

// --- Reports ---------------------------------------------------------------------------------------

export async function findCommunitiesForModeration(ids: string[]) {
  if (ids.length === 0) return [];
  return db.community.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, slug: true, hiddenAt: true },
  });
}

export async function findPostsForModeration(ids: string[]) {
  if (ids.length === 0) return [];
  return db.communityPost.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      body: true,
      hiddenAt: true,
      parentId: true,
      community: { select: { slug: true } },
    },
  });
}

export async function updateCommunityHidden(id: string, hidden: boolean): Promise<void> {
  await db.community.update({ where: { id }, data: { hiddenAt: hidden ? new Date() : null } });
}

// --- Account deletion (COM-08) ---------------------------------------------------------------------

/**
 * Inside the account-deletion transaction: each owned community goes to its oldest moderator, or is
 * deleted when it has none, and the member's own discussion posts are deleted. Returns the photo
 * ids to clean up.
 */
export async function removeUserFromCommunities(userId: string, tx: Tx): Promise<string[]> {
  const mediaIds: string[] = [];
  const owned = await tx.communityMember.findMany({
    where: { userId, role: "OWNER" },
    select: { communityId: true },
  });
  for (const { communityId } of owned) {
    const heir = await tx.communityMember.findFirst({
      where: { communityId, role: "MODERATOR", removedAt: null },
      orderBy: [{ joinedAt: "asc" }, { userId: "asc" }],
      select: { userId: true },
    });
    if (heir) {
      await tx.communityMember.update({
        where: { communityId_userId: { communityId, userId: heir.userId } },
        data: { role: "OWNER" },
      });
      await tx.community.update({ where: { id: communityId }, data: { createdById: heir.userId } });
    } else {
      mediaIds.push(...(await mediaOfPosts(tx, { communityId })));
      await tx.community.delete({ where: { id: communityId } });
    }
  }
  const own: Prisma.CommunityPostWhereInput = { authorId: userId };
  mediaIds.push(...(await mediaOfPosts(tx, { OR: [own, { parent: own }] })));
  await tx.communityPost.deleteMany({ where: own });
  return mediaIds;
}
