import "server-only";

import type {
  CreateEntryInput,
  CreateProjectInput,
  ProjectListQuery,
  UpdateEntryInput,
  UpdateProjectInput,
} from "@/lib/schemas/journal";
import { MAX_ENTRIES, MAX_PROJECTS } from "@/lib/schemas/journal";
import type { Project, ProjectEntry, ProjectSummary } from "@/lib/types/journal";
import type { Media } from "@/lib/types/media";
import type { CreatorSummary } from "@/lib/types/posts";
import type { SkillSummary } from "@/lib/types/skills";
import { db } from "@/server/db/client";
import type { MediaProvider } from "@/server/integrations/media";
import type { Actor, AuthenticatedActor } from "@/server/lib/actor";
import {
  ForbiddenError,
  NotFoundError,
  UnauthenticatedError,
  UnprocessableError,
  ValidationError,
} from "@/server/lib/errors";
import {
  avatarUrl,
  deleteUnusedMedia,
  getMediaMap,
  getOwnedMediaIds,
  getPostDetail,
} from "@/server/modules/content";
import { getActiveSkillSummaries } from "@/server/modules/skills";
import { getCreatorProfiles, getProfileForView } from "@/server/modules/users";

import { canSeeProject } from "./policies";
import {
  countEntries,
  countProjects,
  deleteEntryRow,
  deleteProjectReturningMedia,
  findEntry,
  findProject,
  findProjectOwner,
  findProjectSummaries,
  insertEntry,
  insertProject,
  setMaterialChecked,
  touchProject,
  updateEntryRow,
  updateProjectRow,
  type ProjectRow,
  type ProjectSummaryRow,
} from "./repository";

// Creative journal (P2-03; PRODUCT_REQUIREMENTS JRN-01…07, API_SPECIFICATION §9.1). Projects are
// private by default; a public one shows on the owner's profile (Projects tab) but never in the
// feed. Making a project public needs a verified email (OD-08).

/** Tests pass a fake media provider; deleting photos goes through it. */
type ProviderOption = { provider?: MediaProvider };

function requireSignedIn(actor: Actor): AuthenticatedActor {
  if (!actor) throw new UnauthenticatedError();
  return actor;
}

function notFound(): NotFoundError {
  return new NotFoundError("We couldn't find that project.");
}

/** Throws 404 unless the project is the actor's own. */
async function requireOwnProject(actor: AuthenticatedActor, id: string) {
  const project = await findProjectOwner(id);
  if (!project || project.ownerId !== actor.id) throw notFound();
}

function requireVerifiedForPublic(actor: AuthenticatedActor, visibility: string | undefined) {
  if (visibility === "PUBLIC" && !actor.isEmailVerified) {
    throw new ForbiddenError("Verify your email to share a project on your profile.", {
      code: "EMAIL_NOT_VERIFIED",
    });
  }
}

/** Entry photos must be the maker's own uploads. */
async function checkEntryMedia(actor: AuthenticatedActor, mediaIds: string[] | undefined) {
  if (!mediaIds || mediaIds.length === 0) return;
  const owned = await getOwnedMediaIds(actor.id, mediaIds);
  if (mediaIds.some((id) => !owned.has(id))) {
    throw new ValidationError(undefined, {
      fields: { mediaIds: "Some photos aren't available. Upload them again." },
    });
  }
}

function toSummary(
  row: ProjectSummaryRow,
  skills: Map<string, SkillSummary>,
  media: Map<string, Media>,
): ProjectSummary {
  const coverId = row.entries[0]?.media[0]?.mediaId;
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    visibility: row.visibility,
    skill: row.skillId ? (skills.get(row.skillId) ?? null) : null,
    coverMedia: coverId ? (media.get(coverId) ?? null) : null,
    entryCount: row._count.entries,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function toSummaries(rows: ProjectSummaryRow[]): Promise<ProjectSummary[]> {
  const [skills, media] = await Promise.all([
    getActiveSkillSummaries(rows.flatMap((row) => row.skillId ?? [])),
    getMediaMap(rows.flatMap((row) => row.entries[0]?.media[0]?.mediaId ?? [])),
  ]);
  return rows.map((row) => toSummary(row, skills, media));
}

async function toProject(row: ProjectRow, actor: Actor, owner: CreatorSummary): Promise<Project> {
  const mediaIds = row.entries.flatMap((entry) => entry.media.map((item) => item.mediaId));
  const [skills, media, source] = await Promise.all([
    getActiveSkillSummaries(row.skillId ? [row.skillId] : []),
    getMediaMap(mediaIds),
    row.sourcePostId
      ? getPostDetail(actor, row.sourcePostId).catch(() => null)
      : Promise.resolve(null),
  ]);
  const total = row.entries.length;
  const entries: ProjectEntry[] = row.entries.map((entry, index) => ({
    id: entry.id,
    number: total - index,
    title: entry.title,
    body: entry.body,
    media: entry.media.flatMap((item) => media.get(item.mediaId) ?? []),
    createdAt: entry.createdAt.toISOString(),
  }));
  return {
    ...toSummary(row, skills, media),
    isOwner: actor?.id === row.ownerId,
    owner,
    sourcePost: source ? { id: source.id, title: source.title } : null,
    materials: row.materials,
    entries,
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

async function ownerSummary(ownerId: string): Promise<CreatorSummary | null> {
  const profile = (await getCreatorProfiles([ownerId])).get(ownerId);
  if (!profile) return null;
  return {
    username: profile.username,
    displayName: profile.displayName,
    avatarUrl: profile.avatarPublicId ? avatarUrl(profile.avatarPublicId) : null,
  };
}

/** GET /api/projects/{id}: the owner's, or anyone signed in for a public project. */
export async function getProject(actor: Actor, id: string): Promise<Project> {
  const viewer = requireSignedIn(actor);
  const row = await findProject(id);
  if (!row || !canSeeProject(viewer, row)) throw notFound();
  // Hidden or deactivated owners: their public projects disappear like their profile.
  const owner = await ownerSummary(row.ownerId);
  if (!owner) {
    if (row.ownerId !== viewer.id) throw notFound();
    return toProject(row, actor, { username: "", displayName: "You", avatarUrl: null });
  }
  return toProject(row, actor, owner);
}

/** GET /api/me/projects: in progress first, then the most recently touched. */
export async function listMyProjects(
  actor: Actor,
  query: ProjectListQuery,
): Promise<ProjectSummary[]> {
  const user = requireSignedIn(actor);
  return toSummaries(await findProjectSummaries({ ownerId: user.id, status: query.status }));
}

/** GET /api/profiles/{username}/projects: public projects; the owner sees all of theirs. */
export async function listProfileProjects(
  actor: Actor,
  username: string,
): Promise<ProjectSummary[]> {
  const profile = await getProfileForView(actor, username);
  if (profile.isPrivate) return [];
  return toSummaries(
    await findProjectSummaries({ ownerId: profile.userId, publicOnly: !profile.isOwner }),
  );
}

async function assertRoomForProject(userId: string) {
  if ((await countProjects(userId)) >= MAX_PROJECTS) {
    throw new UnprocessableError(
      `You have ${MAX_PROJECTS} projects. Delete one to start another.`,
      { code: "PROJECT_LIMIT" },
    );
  }
}

/** POST /api/me/projects. */
export async function createProject(
  actor: Actor,
  input: Omit<CreateProjectInput, "materials"> & { materials?: string[] },
): Promise<Project> {
  const user = requireSignedIn(actor);
  requireVerifiedForPublic(user, input.visibility);
  await assertRoomForProject(user.id);
  if (input.skillId && !(await getActiveSkillSummaries([input.skillId])).has(input.skillId)) {
    throw new ValidationError(undefined, { fields: { skillId: "That craft isn't available." } });
  }
  const id = await db.$transaction((tx) =>
    insertProject(
      {
        ownerId: user.id,
        title: input.title,
        skillId: input.skillId,
        visibility: input.visibility,
        materials: (input.materials ?? []).map((name) => ({ name, note: null })),
      },
      tx,
    ),
  );
  return getProject(actor, id);
}

/**
 * POST /api/posts/{postId}/start-project ("Start as my project", JRN-03): a private project named
 * after the tutorial, on its main skill, with its materials as the checklist.
 */
export async function startProjectFromPost(actor: Actor, postId: string): Promise<Project> {
  const user = requireSignedIn(actor);
  const post = await getPostDetail(actor, postId);
  if (post.type !== "TUTORIAL") {
    throw new UnprocessableError("Projects start from tutorials.", { code: "NOT_A_TUTORIAL" });
  }
  await assertRoomForProject(user.id);
  const id = await db.$transaction((tx) =>
    insertProject(
      {
        ownerId: user.id,
        title: post.title.slice(0, 80),
        skillId: post.primarySkillId || null,
        visibility: "PRIVATE",
        sourcePostId: post.id,
        materials: post.materials.map((material) => ({
          name: material.name,
          note: material.note,
        })),
      },
      tx,
    ),
  );
  return getProject(actor, id);
}

/** PATCH /api/projects/{id}: completing sets the date (JRN-04); reopening clears it. */
export async function updateProject(
  actor: Actor,
  id: string,
  input: UpdateProjectInput,
): Promise<Project> {
  const user = requireSignedIn(actor);
  await requireOwnProject(user, id);
  requireVerifiedForPublic(user, input.visibility);
  if (input.skillId && !(await getActiveSkillSummaries([input.skillId])).has(input.skillId)) {
    throw new ValidationError(undefined, { fields: { skillId: "That craft isn't available." } });
  }
  await updateProjectRow(id, {
    ...input,
    ...(input.status === "COMPLETED" ? { completedAt: new Date() } : {}),
    ...(input.status === "IN_PROGRESS" ? { completedAt: null } : {}),
  });
  return getProject(actor, id);
}

/** DELETE /api/projects/{id}: the project, its entries, and their photos used nowhere else. */
export async function deleteProject(
  actor: Actor,
  id: string,
  options: ProviderOption = {},
): Promise<void> {
  const user = requireSignedIn(actor);
  await requireOwnProject(user, id);
  const mediaIds = await db.$transaction((tx) => deleteProjectReturningMedia(id, tx));
  await deleteUnusedMedia(mediaIds, options);
}

/** POST /api/projects/{id}/entries (JRN-02): up to 200 entries, up to 4 of the maker's photos. */
export async function addEntry(
  actor: Actor,
  projectId: string,
  input: CreateEntryInput,
): Promise<Project> {
  const user = requireSignedIn(actor);
  await requireOwnProject(user, projectId);
  if ((await countEntries(projectId)) >= MAX_ENTRIES) {
    throw new UnprocessableError(`A project can have up to ${MAX_ENTRIES} entries.`, {
      code: "ENTRY_LIMIT",
    });
  }
  await checkEntryMedia(user, input.mediaIds);
  await db.$transaction(async (tx) => {
    await insertEntry(projectId, input, tx);
    await touchProject(projectId, tx);
  });
  return getProject(actor, projectId);
}

/** PATCH /api/projects/{id}/entries/{entryId}. */
export async function updateEntry(
  actor: Actor,
  projectId: string,
  entryId: string,
  input: UpdateEntryInput,
  options: ProviderOption = {},
): Promise<Project> {
  const user = requireSignedIn(actor);
  await requireOwnProject(user, projectId);
  const entry = await findEntry(projectId, entryId);
  if (!entry) throw new NotFoundError("We couldn't find that entry.");
  await checkEntryMedia(user, input.mediaIds);
  await db.$transaction(async (tx) => {
    await updateEntryRow(entryId, input, tx);
    await touchProject(projectId, tx);
  });
  if (input.mediaIds) {
    const kept = new Set(input.mediaIds);
    await deleteUnusedMedia(
      entry.media.map((item) => item.mediaId).filter((id) => !kept.has(id)),
      options,
    );
  }
  return getProject(actor, projectId);
}

/** DELETE /api/projects/{id}/entries/{entryId}. */
export async function deleteEntry(
  actor: Actor,
  projectId: string,
  entryId: string,
  options: ProviderOption = {},
) {
  const user = requireSignedIn(actor);
  await requireOwnProject(user, projectId);
  const entry = await findEntry(projectId, entryId);
  if (!entry) throw new NotFoundError("We couldn't find that entry.");
  await db.$transaction((tx) => deleteEntryRow(entryId, tx));
  await deleteUnusedMedia(
    entry.media.map((item) => item.mediaId),
    options,
  );
}

/** PUT /api/projects/{id}/materials/{materialId}: tick or untick (owner only). */
export async function checkMaterial(
  actor: Actor,
  projectId: string,
  materialId: string,
  checked: boolean,
): Promise<void> {
  const user = requireSignedIn(actor);
  await requireOwnProject(user, projectId);
  if (!(await setMaterialChecked(projectId, materialId, checked))) {
    throw new NotFoundError("We couldn't find that material.");
  }
}

/** Whether `projectId` is the actor's (a post shared from it links back, JRN-05). */
export async function isOwnProject(actor: Actor, projectId: string): Promise<boolean> {
  if (!actor) return false;
  return (await findProjectOwner(projectId))?.ownerId === actor.id;
}
