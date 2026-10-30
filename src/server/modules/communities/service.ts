import "server-only";

import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants/pagination";
import type {
  CommunityListQuery,
  CommunityModerationInput,
  CreateCommunityInput,
  CreateCommunityPostInput,
} from "@/lib/schemas/communities";
import type { Paginated } from "@/lib/types/api";
import type {
  CommunityCard,
  CommunityDetail,
  CommunityManageView,
  CommunityMemberView,
  CommunityPostView,
  CommunityRoleName,
  CommunityThread,
} from "@/lib/types/communities";
import type { CreatorSummary } from "@/lib/types/posts";
import type { MediaProvider } from "@/server/integrations/media";
import type { Actor, AuthenticatedActor } from "@/server/lib/actor";
import {
  ForbiddenError,
  NotFoundError,
  UnauthenticatedError,
  UnprocessableError,
  ValidationError,
} from "@/server/lib/errors";
import { decodeCursor, encodeCursor } from "@/server/lib/pagination";
import { enforceRateLimit, type RateLimitRule } from "@/server/lib/rate-limit";
import {
  avatarUrl,
  deleteUnusedMedia,
  getMediaMap,
  getOwnedMediaIds,
} from "@/server/modules/content";
import { containsOffensiveWords, getActiveSkillSummaries } from "@/server/modules/skills";
import { getBlockedUserIds, getCreatorProfiles, getInterestProfile } from "@/server/modules/users";

import {
  countMembers,
  countOwnedCommunities,
  deleteCommunityReturningMedia,
  deleteMember,
  deletePostReturningMedia,
  findCommunities,
  findCommunitiesForModeration,
  findCommunityById,
  findCommunityBySlug,
  findLog,
  findMember,
  findMembersForManage,
  findMembershipsOf,
  findPost,
  findPostsForModeration,
  findRemovedMembers,
  findRepliesOf,
  findTopLevelPosts,
  insertCommunity,
  insertLog,
  insertMember,
  insertPost,
  markMemberRemoved,
  normalizedNameExists,
  slugExists,
  transferOwnership,
  updateCommunityHidden,
  updateMemberRole,
  updatePostBody,
  updatePostHidden,
  type CommunityPosition,
  type CommunityRow,
  type MemberRow,
  type PostPosition,
  type PostRow,
} from "./repository";

// Communities (P3-01; PRODUCT_REQUIREMENTS COM-01…08, USER_FLOWS F-28). Public communities only
// (OD-06): any signed-in member can read, a verified member can create, join and post. Owners and
// moderators act only inside their community and every action is logged without content. Blocks
// work both ways on posts and replies; a hidden community or post is not found.

/** COM-01: 2 communities created a day per member. */
export const COMMUNITY_CREATE_RATE_LIMIT: RateLimitRule = {
  name: "community-create",
  limit: 2,
  windowSeconds: 24 * 60 * 60,
};
/** COM-01: 10 communities owned in total. */
export const COMMUNITY_OWNED_LIMIT = 10;
/**
 * Discussion posts and replies per member. The requirements give no number; this reuses the
 * comments limit (30 an hour) until the PO decides (README §2, "PO to confirm").
 */
export const COMMUNITY_POST_RATE_LIMIT: RateLimitRule = {
  name: "community-post-create",
  limit: 30,
  windowSeconds: 60 * 60,
};
/** COM-05: the author can edit for 15 minutes. */
export const COMMUNITY_EDIT_WINDOW_MS = 15 * 60 * 1000;

const MANAGE_MEMBER_LIMIT = 100;
const MANAGE_LOG_LIMIT = 50;
/** A slug that would shadow a fixed route under /community/circles. */
const RESERVED_SLUGS = new Set(["new"]);

const listCursorSchema = z.object({
  phase: z.union([z.literal(0), z.literal(1)]),
  createdAt: z.iso.datetime(),
  id: z.string().min(1).max(40),
});
const postCursorSchema = z.object({ activityAt: z.iso.datetime(), id: z.string().min(1).max(40) });

function requireSignedIn(actor: Actor): AuthenticatedActor {
  if (!actor) throw new UnauthenticatedError();
  return actor;
}

function requireVerified(actor: Actor, action: string): AuthenticatedActor {
  const user = requireSignedIn(actor);
  if (!user.isEmailVerified) {
    throw new ForbiddenError(`Verify your email to ${action}.`, { code: "EMAIL_NOT_VERIFIED" });
  }
  return user;
}

const communityNotFound = () => new NotFoundError("We couldn't find that community.");
const postNotFound = () => new NotFoundError("We couldn't find that post.");

function creatorSummary(
  profile: { username: string; displayName: string; avatarPublicId: string | null } | undefined,
): CreatorSummary | null {
  return profile
    ? {
        username: profile.username,
        displayName: profile.displayName,
        avatarUrl: profile.avatarPublicId ? avatarUrl(profile.avatarPublicId) : null,
      }
    : null;
}

/** The viewer's role, or null when they have not joined or were removed. */
function activeRole(member: MemberRow | null | undefined): CommunityRoleName | null {
  return member && !member.removedAt ? member.role : null;
}

function isManagerRole(role: CommunityRoleName | null): boolean {
  return role === "OWNER" || role === "MODERATOR";
}

// --- Creating and finding ----------------------------------------------------------------------------

function slugOf(name: string): string {
  const base = name
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[&']/gu, "")
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 50)
    .replace(/-+$/u, "");
  return base || "community";
}

async function freeSlug(name: string): Promise<string> {
  const base = slugOf(name);
  for (let attempt = 1; attempt < 50; attempt++) {
    const candidate = attempt === 1 ? base : `${base}-${attempt}`;
    if (!RESERVED_SLUGS.has(candidate) && !(await slugExists(candidate))) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

async function toCards(actor: AuthenticatedActor, rows: CommunityRow[]): Promise<CommunityCard[]> {
  const [skills, memberships] = await Promise.all([
    getActiveSkillSummaries([...new Set(rows.map((row) => row.skillId))]),
    findMembershipsOf(
      actor.id,
      rows.map((row) => row.id),
    ),
  ]);
  return rows.map((row) => {
    const skill = skills.get(row.skillId);
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      skill: skill
        ? { id: skill.id, name: skill.name, slug: skill.slug, accent: skill.accent }
        : null,
      myRole: activeRole(memberships.get(row.id)),
    };
  });
}

/** Rows the viewer may open: published and not hidden. A hidden community is not found for anyone. */
async function loadVisible(slug: string): Promise<CommunityRow> {
  const row = await findCommunityBySlug(slug);
  if (!row || row.hiddenAt) throw communityNotFound();
  return row;
}

async function toDetail(user: AuthenticatedActor, row: CommunityRow): Promise<CommunityDetail> {
  const [[card], member] = await Promise.all([toCards(user, [row]), findMember(row.id, user.id)]);
  if (!card) throw communityNotFound();
  const isRemoved = Boolean(member?.removedAt);
  return {
    ...card,
    rules: row.rules,
    isRemoved,
    canJoin: user.isEmailVerified && !member,
    canPost: user.isEmailVerified && activeRole(member) !== null,
  };
}

/** POST /api/communities (COM-01, COM-02). */
export async function createCommunity(
  actor: Actor,
  input: CreateCommunityInput,
): Promise<CommunityDetail> {
  const user = requireVerified(actor, "start a community");
  // The route already tidies the name; this keeps the uniqueness key right for any caller.
  const name = input.name.normalize("NFKC").trim().replace(/\s+/gu, " ");
  if (!(await getActiveSkillSummaries([input.skillId])).has(input.skillId)) {
    throw new ValidationError(undefined, { fields: { skillId: "That craft isn't available." } });
  }
  const fields: Record<string, string> = {};
  if (containsOffensiveWords(name)) fields.name = "Please choose a different name.";
  if (containsOffensiveWords(input.description)) {
    fields.description = "Please reword the description.";
  }
  const badRule = input.rules.findIndex((rule) => containsOffensiveWords(rule));
  if (badRule >= 0) fields.rules = `Please reword rule ${badRule + 1}.`;
  if (Object.keys(fields).length > 0) throw new ValidationError(undefined, { fields });

  const normalizedName = name.toLocaleLowerCase("en");
  const nameTaken = () =>
    new UnprocessableError("A community with that name already exists.", {
      code: "NAME_TAKEN",
      fields: { name: "A community with that name already exists." },
    });
  if (await normalizedNameExists(normalizedName)) throw nameTaken();
  if ((await countOwnedCommunities(user.id)) >= COMMUNITY_OWNED_LIMIT) {
    throw new UnprocessableError(
      `You can run up to ${COMMUNITY_OWNED_LIMIT} communities. Hand one over or delete it first.`,
      { code: "COMMUNITY_LIMIT" },
    );
  }
  await enforceRateLimit(COMMUNITY_CREATE_RATE_LIMIT, user.id);

  const row = await insertCommunity({
    name,
    normalizedName,
    slug: await freeSlug(name),
    skillId: input.skillId,
    description: input.description,
    rules: input.rules,
    createdById: user.id,
  });
  // A concurrent request took the name or the slug between the check and the insert.
  if (!row) throw nameTaken();
  return toDetail(user, row);
}

function whereForList(
  user: AuthenticatedActor,
  query: CommunityListQuery,
  interestIds: string[],
  phase: 0 | 1 | null,
): Prisma.CommunityWhereInput {
  const and: Prisma.CommunityWhereInput[] = [{ hiddenAt: null }];
  if (query.mine) and.push({ members: { some: { userId: user.id, removedAt: null } } });
  if (query.q) and.push({ name: { contains: query.q, mode: "insensitive" } });
  if (query.skill) and.push({ skillId: query.skill });
  if (phase === 0) and.push({ skillId: { in: interestIds } });
  if (phase === 1) and.push({ skillId: { notIn: interestIds } });
  return { AND: and };
}

/**
 * GET /api/communities: discovery lists communities in the member's interests first, then the
 * rest, newest first in each part (COM-03); `mine` lists the member's own circles.
 */
export async function listCommunities(
  actor: Actor,
  query: CommunityListQuery,
): Promise<Paginated<CommunityCard>> {
  const user = requireSignedIn(actor);
  const interestIds = query.mine
    ? []
    : [...new Set((await getInterestProfile(user.id)).map(({ skillId }) => skillId))];
  const cursor = query.cursor ? decodeCursor(query.cursor, listCursorSchema) : null;

  const wanted = DEFAULT_PAGE_SIZE + 1;
  const rows: { row: CommunityRow; phase: 0 | 1 | null }[] = [];
  if (query.mine || interestIds.length === 0) {
    const found = await findCommunities({
      where: whereForList(user, query, interestIds, null),
      after: cursor ? { createdAt: new Date(cursor.createdAt), id: cursor.id } : null,
      take: wanted,
    });
    rows.push(...found.map((row) => ({ row, phase: null })));
  } else {
    let phase: 0 | 1 = cursor?.phase ?? 0;
    let after: CommunityPosition | null = cursor
      ? { createdAt: new Date(cursor.createdAt), id: cursor.id }
      : null;
    for (;;) {
      const found = await findCommunities({
        where: whereForList(user, query, interestIds, phase),
        after,
        take: wanted - rows.length,
      });
      rows.push(...found.map((row) => ({ row, phase })));
      if (rows.length >= wanted || phase === 1) break;
      phase = 1;
      after = null;
    }
  }

  const page = rows.slice(0, DEFAULT_PAGE_SIZE);
  const last = page.at(-1);
  return {
    items: await toCards(
      user,
      page.map(({ row }) => row),
    ),
    nextCursor:
      rows.length > DEFAULT_PAGE_SIZE && last
        ? encodeCursor({
            phase: last.phase ?? 1,
            createdAt: last.row.createdAt.toISOString(),
            id: last.row.id,
          })
        : null,
  };
}

/** GET /api/communities/{slug}: details and rules; a hidden community is not found. */
export async function getCommunityBySlug(actor: Actor, slug: string): Promise<CommunityDetail> {
  const user = requireSignedIn(actor);
  return toDetail(user, await loadVisible(slug));
}

// --- Joining and leaving ---------------------------------------------------------------------------------

/** PUT /api/communities/{slug}/membership (COM-03). Joining again is fine; a removed member is refused. */
export async function joinCommunity(actor: Actor, slug: string): Promise<void> {
  const user = requireVerified(actor, "join a community");
  const community = await loadVisible(slug);
  const member = await findMember(community.id, user.id);
  if (member?.removedAt) {
    throw new ForbiddenError("You were removed from this community.", { code: "REMOVED" });
  }
  if (!member) await insertMember(community.id, user.id);
}

/** DELETE /api/communities/{slug}/membership (COM-03, COM-04). */
export async function leaveCommunity(actor: Actor, slug: string): Promise<void> {
  const user = requireVerified(actor, "leave a community");
  const community = await loadVisible(slug);
  const member = await findMember(community.id, user.id);
  if (!member || member.removedAt) return;
  if (member.role === "OWNER") {
    throw new UnprocessableError(
      "Hand ownership to a moderator or delete the community before you leave.",
      { code: "OWNER_MUST_HAND_OVER" },
    );
  }
  await deleteMember(community.id, user.id);
}

// --- Discussions -------------------------------------------------------------------------------------------

type PostViewer = { user: AuthenticatedActor; role: CommunityRoleName | null };

async function toPostViews(
  viewer: PostViewer,
  rows: PostRow[],
  now: Date,
): Promise<Map<string, CommunityPostView>> {
  const [media, creators] = await Promise.all([
    getMediaMap(rows.flatMap((row) => row.photos.map((photo) => photo.mediaId))),
    getCreatorProfiles([...new Set(rows.flatMap((row) => (row.authorId ? [row.authorId] : [])))]),
  ]);
  const manager = isManagerRole(viewer.role);
  return new Map(
    rows.map((row) => {
      const isOwn = row.authorId === viewer.user.id;
      return [
        row.id,
        {
          id: row.id,
          body: row.body,
          author: row.authorId ? creatorSummary(creators.get(row.authorId)) : null,
          isOwn,
          photos: row.photos.flatMap((photo) => {
            const item = media.get(photo.mediaId);
            return item ? [item] : [];
          }),
          isHidden: row.hiddenAt !== null,
          canEdit:
            isOwn &&
            !row.hiddenAt &&
            now.getTime() - row.createdAt.getTime() < COMMUNITY_EDIT_WINDOW_MS,
          canDelete: isOwn || manager,
          isEdited: row.editedAt !== null,
          createdAt: row.createdAt.toISOString(),
        },
      ];
    }),
  );
}

async function viewerIn(user: AuthenticatedActor, communityId: string): Promise<PostViewer> {
  return { user, role: activeRole(await findMember(communityId, user.id)) };
}

/** GET /api/communities/{slug}/posts: discussions with their replies, newest activity first (COM-05). */
export async function listCommunityPosts(
  actor: Actor,
  slug: string,
  options: { cursor?: string; now?: Date } = {},
): Promise<Paginated<CommunityThread>> {
  const user = requireSignedIn(actor);
  const community = await loadVisible(slug);
  const [viewer, blocked] = await Promise.all([
    viewerIn(user, community.id),
    getBlockedUserIds(user.id),
  ]);
  const manager = isManagerRole(viewer.role);
  const cursor = options.cursor ? decodeCursor(options.cursor, postCursorSchema) : null;
  const after: PostPosition | null = cursor
    ? { activityAt: new Date(cursor.activityAt), id: cursor.id }
    : null;

  const rows = await findTopLevelPosts({
    communityId: community.id,
    viewerId: user.id,
    isManager: manager,
    excludeAuthorIds: [...blocked],
    after,
    take: DEFAULT_PAGE_SIZE + 1,
  });
  const page = rows.slice(0, DEFAULT_PAGE_SIZE);
  const replies = (await findRepliesOf(page.map((row) => row.id))).filter(
    (reply) =>
      !(reply.authorId && blocked.has(reply.authorId)) &&
      (!reply.hiddenAt || manager || reply.authorId === user.id),
  );
  const views = await toPostViews(viewer, [...page, ...replies], options.now ?? new Date());
  const last = page.at(-1);
  return {
    items: page.flatMap((row) => {
      const view = views.get(row.id);
      return view
        ? [
            {
              ...view,
              replies: replies
                .filter((reply) => reply.parentId === row.id)
                .flatMap((reply) => {
                  const replyView = views.get(reply.id);
                  return replyView ? [replyView] : [];
                }),
            },
          ]
        : [];
    }),
    nextCursor:
      rows.length > DEFAULT_PAGE_SIZE && last
        ? encodeCursor({ activityAt: last.activityAt.toISOString(), id: last.id })
        : null,
  };
}

/** POST /api/communities/{slug}/posts (COM-05): a post with photos, or a text reply to one. */
export async function createCommunityPost(
  actor: Actor,
  slug: string,
  input: CreateCommunityPostInput,
  { now = new Date() }: { now?: Date } = {},
): Promise<CommunityPostView> {
  const user = requireVerified(actor, "post in a community");
  const community = await loadVisible(slug);
  const viewer = await viewerIn(user, community.id);
  if (!viewer.role) {
    throw new ForbiddenError("Join this community to post.", { code: "NOT_MEMBER" });
  }

  if (input.parentId) {
    if (input.mediaIds.length > 0) {
      throw new ValidationError(undefined, {
        fields: { mediaIds: "Replies are text only." },
      });
    }
    const parent = await findPost(input.parentId);
    const blocked = await getBlockedUserIds(user.id);
    if (
      !parent ||
      parent.communityId !== community.id ||
      parent.parentId ||
      (parent.hiddenAt && !isManagerRole(viewer.role)) ||
      (parent.authorId && blocked.has(parent.authorId))
    ) {
      throw postNotFound();
    }
  }
  if (input.mediaIds.length > 0) {
    const owned = await getOwnedMediaIds(user.id, input.mediaIds);
    if (input.mediaIds.some((id) => !owned.has(id))) {
      throw new ValidationError(undefined, {
        fields: { mediaIds: "Some photos aren't available. Upload them again." },
      });
    }
  }
  await enforceRateLimit(COMMUNITY_POST_RATE_LIMIT, user.id);
  const id = await insertPost({
    communityId: community.id,
    authorId: user.id,
    parentId: input.parentId ?? null,
    body: input.body,
    mediaIds: input.mediaIds,
  });
  const row = await findPost(id);
  const view = row ? (await toPostViews(viewer, [row], now)).get(id) : undefined;
  if (!view) throw postNotFound();
  return view;
}

/** What the viewer may do with a post: its row, its community and their role there. */
async function loadPostForViewer(
  user: AuthenticatedActor,
  id: string,
): Promise<{ post: PostRow; community: CommunityRow; viewer: PostViewer }> {
  const post = await findPost(id);
  const community = post ? await findCommunityById(post.communityId) : null;
  if (!post || !community || community.hiddenAt) throw postNotFound();
  const viewer = await viewerIn(user, community.id);
  const isOwn = post.authorId === user.id;
  if (post.hiddenAt && !isOwn && !isManagerRole(viewer.role)) throw postNotFound();
  return { post, community, viewer };
}

/** PATCH /api/community-posts/{id}: only the author, for 15 minutes (COM-05). */
export async function updateCommunityPost(
  actor: Actor,
  id: string,
  input: { body: string },
  { now = new Date() }: { now?: Date } = {},
): Promise<CommunityPostView> {
  const user = requireVerified(actor, "edit your post");
  const { post, viewer } = await loadPostForViewer(user, id);
  if (post.authorId !== user.id || post.hiddenAt || !viewer.role) throw postNotFound();
  if (now.getTime() - post.createdAt.getTime() >= COMMUNITY_EDIT_WINDOW_MS) {
    throw new UnprocessableError("You can edit a post for 15 minutes after posting it.", {
      code: "EDIT_WINDOW_CLOSED",
    });
  }
  await updatePostBody(id, input.body);
  const row = await findPost(id);
  const view = row ? (await toPostViews(viewer, [row], now)).get(id) : undefined;
  if (!view) throw postNotFound();
  return view;
}

/** DELETE /api/community-posts/{id}: the author any time; owner and moderators too, and it is logged. */
export async function deleteCommunityPost(
  actor: Actor,
  id: string,
  options: { provider?: MediaProvider } = {},
): Promise<void> {
  const user = requireSignedIn(actor);
  const { post, community, viewer } = await loadPostForViewer(user, id);
  const isOwn = post.authorId === user.id;
  if (!isOwn && !isManagerRole(viewer.role)) throw postNotFound();
  const mediaIds = await deletePostReturningMedia(id);
  if (!isOwn) {
    await insertLog({
      communityId: community.id,
      actorId: user.id,
      action: "post.delete",
      targetType: "post",
      targetId: id,
    });
  }
  await deleteUnusedMedia(mediaIds, options);
}

// --- Moderation --------------------------------------------------------------------------------------------

function invalidTarget(message: string) {
  return new UnprocessableError(message, { code: "INVALID_TARGET" });
}

async function requireManager(
  user: AuthenticatedActor,
  communityId: string,
): Promise<CommunityRoleName> {
  const role = activeRole(await findMember(communityId, user.id));
  if (!isManagerRole(role) || !role) {
    throw new ForbiddenError("Only the owner and moderators can do that.", { code: "NOT_MANAGER" });
  }
  return role;
}

/** POST /api/communities/{slug}/moderation (COM-04, COM-06): every action is logged, never content. */
export async function moderateCommunity(
  actor: Actor,
  slug: string,
  input: CommunityModerationInput,
): Promise<void> {
  const user = requireSignedIn(actor);
  const community = await loadVisible(slug);
  const role = await requireManager(user, community.id);
  const isOwner = role === "OWNER";
  const log = (action: string, targetType: "post" | "member", targetId: string) =>
    insertLog({ communityId: community.id, actorId: user.id, action, targetType, targetId });

  switch (input.action) {
    case "HIDE_POST":
    case "RESTORE_POST": {
      const post = await findPost(input.targetId);
      if (!post || post.communityId !== community.id) throw postNotFound();
      const hide = input.action === "HIDE_POST";
      await updatePostHidden(post.id, hide);
      await log(hide ? "post.hide" : "post.restore", "post", post.id);
      return;
    }
    case "REMOVE_MEMBER": {
      const target = await findMember(community.id, input.targetId);
      if (!target || target.removedAt || target.userId === user.id || target.role === "OWNER") {
        throw invalidTarget("That member can't be removed.");
      }
      if (target.role === "MODERATOR" && !isOwner) {
        throw new ForbiddenError("Only the owner can remove a moderator.", { code: "NOT_OWNER" });
      }
      await markMemberRemoved(community.id, target.userId);
      await log("member.remove", "member", target.userId);
      return;
    }
    case "ALLOW_MEMBER": {
      if (!isOwner) {
        throw new ForbiddenError("Only the owner can let a removed member back.", {
          code: "NOT_OWNER",
        });
      }
      const target = await findMember(community.id, input.targetId);
      if (!target?.removedAt) throw invalidTarget("That member wasn't removed.");
      await deleteMember(community.id, target.userId);
      await log("member.allow", "member", target.userId);
      return;
    }
    case "SET_ROLE": {
      if (!isOwner) {
        throw new ForbiddenError("Only the owner can change roles.", { code: "NOT_OWNER" });
      }
      const target = await findMember(community.id, input.targetId);
      if (!target || target.removedAt || target.userId === user.id) {
        throw invalidTarget("That member can't change role.");
      }
      if (input.role === "OWNER") {
        // Handing the community over: the new owner is a moderator first (COM-04).
        if (target.role !== "MODERATOR") {
          throw invalidTarget("Make them a moderator before handing the community over.");
        }
        await transferOwnership(community.id, user.id, target.userId);
      } else {
        await updateMemberRole(community.id, target.userId, input.role);
      }
      await log("role.change", "member", target.userId);
      return;
    }
  }
}

/** GET /api/communities/{slug}/moderation-log: members, removed members and the audit list, for managers. */
export async function getCommunityManageView(
  actor: Actor,
  slug: string,
): Promise<CommunityManageView> {
  const user = requireSignedIn(actor);
  const community = await loadVisible(slug);
  await requireManager(user, community.id);
  const [memberCount, members, removed, log] = await Promise.all([
    countMembers(community.id),
    findMembersForManage(community.id, MANAGE_MEMBER_LIMIT),
    findRemovedMembers(community.id),
    findLog(community.id, MANAGE_LOG_LIMIT),
  ]);
  const people = await getCreatorProfiles([
    ...new Set([
      ...members.map((member) => member.userId),
      ...removed.map((member) => member.userId),
      ...log.flatMap((entry) => (entry.actorId ? [entry.actorId] : [])),
    ]),
  ]);
  const toMember = (member: MemberRow): CommunityMemberView[] => {
    const person = people.get(member.userId);
    return person
      ? [
          {
            userId: member.userId,
            username: person.username,
            displayName: person.displayName,
            role: member.role,
          },
        ]
      : [];
  };
  return {
    memberCount,
    members: members.flatMap(toMember),
    removed: removed.flatMap(toMember),
    log: log.map((entry) => {
      const person = entry.actorId ? people.get(entry.actorId) : undefined;
      return {
        id: entry.id,
        action: entry.action,
        actor: person ? { username: person.username, displayName: person.displayName } : null,
        targetType: entry.targetType,
        createdAt: entry.createdAt.toISOString(),
      };
    }),
  };
}

/** DELETE /api/communities/{slug} (COM-08): only the owner; discussions and photos go with it. */
export async function deleteCommunity(
  actor: Actor,
  slug: string,
  options: { provider?: MediaProvider } = {},
): Promise<void> {
  const user = requireSignedIn(actor);
  const community = await loadVisible(slug);
  const role = activeRole(await findMember(community.id, user.id));
  if (role !== "OWNER") {
    throw new ForbiddenError("Only the owner can delete a community.", { code: "NOT_OWNER" });
  }
  const mediaIds = await deleteCommunityReturningMedia(community.id);
  await deleteUnusedMedia(mediaIds, options);
}

// --- For reports (COM-06, COM-07) ----------------------------------------------------------------------------

/**
 * Whether `actor` may report this community or post: it must be visible to them (not hidden, not by
 * someone blocked) and not their own. Returns what the report stores.
 */
export async function getReportableCommunityTarget(
  actor: Actor,
  type: "COMMUNITY" | "POST",
  id: string,
): Promise<{ id: string; authorId: string | null } | null> {
  const user = requireSignedIn(actor);
  if (type === "COMMUNITY") {
    const community = await findCommunityById(id);
    if (!community || community.hiddenAt) return null;
    return { id: community.id, authorId: community.createdById };
  }
  const post = await findPost(id);
  const community = post ? await findCommunityById(post.communityId) : null;
  if (!post || !community || community.hiddenAt || post.hiddenAt) return null;
  if (post.authorId && (await getBlockedUserIds(user.id)).has(post.authorId)) return null;
  return { id: post.id, authorId: post.authorId };
}

export async function getCommunitiesForModeration(ids: string[]) {
  return new Map(
    (await findCommunitiesForModeration(ids)).map((row) => [
      row.id,
      { name: row.name, slug: row.slug, isHidden: row.hiddenAt !== null },
    ]),
  );
}

export async function getCommunityPostsForModeration(ids: string[]) {
  return new Map(
    (await findPostsForModeration(ids)).map((row) => [
      row.id,
      {
        body: row.body,
        slug: row.community.slug,
        isReply: row.parentId !== null,
        isHidden: row.hiddenAt !== null,
      },
    ]),
  );
}

export async function setCommunityHidden(id: string, hidden: boolean): Promise<void> {
  await updateCommunityHidden(id, hidden);
}

export async function setCommunityPostHidden(id: string, hidden: boolean): Promise<void> {
  await updatePostHidden(id, hidden);
}
