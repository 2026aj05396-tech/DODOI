import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db/client";

// Journal tables (project, project_material, project_entry, project_entry_media). Media rows belong
// to the content module: only their ids are stored and read here.

type Tx = Prisma.TransactionClient;

const summarySelect = {
  id: true,
  ownerId: true,
  title: true,
  skillId: true,
  status: true,
  visibility: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { entries: true } },
  entries: {
    orderBy: { createdAt: "desc" },
    take: 1,
    select: { media: { orderBy: { position: "asc" }, take: 1, select: { mediaId: true } } },
  },
} satisfies Prisma.ProjectSelect;

export type ProjectSummaryRow = Prisma.ProjectGetPayload<{ select: typeof summarySelect }>;

const projectSelect = {
  ...summarySelect,
  sourcePostId: true,
  completedAt: true,
  materials: {
    orderBy: { position: "asc" },
    select: { id: true, name: true, note: true, checked: true },
  },
  entries: {
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      body: true,
      createdAt: true,
      media: { orderBy: { position: "asc" }, select: { mediaId: true } },
    },
  },
} satisfies Prisma.ProjectSelect;

export type ProjectRow = Prisma.ProjectGetPayload<{ select: typeof projectSelect }>;

export async function findProjectSummaries(options: {
  ownerId: string;
  status?: "IN_PROGRESS" | "COMPLETED";
  publicOnly?: boolean;
}) {
  return db.project.findMany({
    where: {
      ownerId: options.ownerId,
      ...(options.status ? { status: options.status } : {}),
      ...(options.publicOnly ? { visibility: "PUBLIC" } : {}),
    },
    // In progress first (JRN, F-18), then the most recently touched.
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    select: summarySelect,
  });
}

export async function findProject(id: string, client: Tx | typeof db = db) {
  return client.project.findUnique({ where: { id }, select: projectSelect });
}

export async function findProjectOwner(id: string) {
  return db.project.findUnique({ where: { id }, select: { ownerId: true } });
}

export async function countProjects(ownerId: string): Promise<number> {
  return db.project.count({ where: { ownerId } });
}

export async function countEntries(projectId: string): Promise<number> {
  return db.projectEntry.count({ where: { projectId } });
}

export async function insertProject(
  data: {
    ownerId: string;
    title: string;
    skillId: string | null;
    visibility: "PRIVATE" | "PUBLIC";
    sourcePostId?: string;
    materials?: { name: string; note: string | null }[];
  },
  tx: Tx,
): Promise<string> {
  const { materials = [], ...fields } = data;
  const project = await tx.project.create({
    data: {
      ...fields,
      materials: {
        create: materials.map((material, position) => ({ ...material, position })),
      },
    },
    select: { id: true },
  });
  return project.id;
}

export async function updateProjectRow(id: string, data: Prisma.ProjectUncheckedUpdateInput) {
  await db.project.update({ where: { id }, data });
}

/** Marks the project as just changed (a new or edited entry), so it moves up the list. */
export async function touchProject(id: string, tx: Tx) {
  await tx.project.update({ where: { id }, data: { updatedAt: new Date() } });
}

/** Deletes the project and returns the photo ids its entries used. */
export async function deleteProjectReturningMedia(id: string, tx: Tx): Promise<string[]> {
  const rows = await tx.projectEntryMedia.findMany({
    where: { entry: { projectId: id } },
    select: { mediaId: true },
  });
  await tx.project.delete({ where: { id } });
  return rows.map((row) => row.mediaId);
}

export async function insertEntry(
  projectId: string,
  data: { title: string | null; body: string | null; mediaIds: string[] },
  tx: Tx,
): Promise<string> {
  const entry = await tx.projectEntry.create({
    data: {
      projectId,
      title: data.title,
      body: data.body,
      media: { create: data.mediaIds.map((mediaId, position) => ({ mediaId, position })) },
    },
    select: { id: true },
  });
  return entry.id;
}

export async function findEntry(projectId: string, entryId: string) {
  return db.projectEntry.findFirst({
    where: { id: entryId, projectId },
    select: { id: true, media: { select: { mediaId: true } } },
  });
}

export async function updateEntryRow(
  entryId: string,
  data: { title?: string | null; body?: string | null; mediaIds?: string[] },
  tx: Tx,
) {
  const { mediaIds, ...fields } = data;
  if (Object.keys(fields).length > 0) {
    await tx.projectEntry.update({ where: { id: entryId }, data: fields });
  }
  if (mediaIds) {
    await tx.projectEntryMedia.deleteMany({ where: { entryId } });
    await tx.projectEntryMedia.createMany({
      data: mediaIds.map((mediaId, position) => ({ entryId, mediaId, position })),
    });
  }
}

export async function deleteEntryRow(entryId: string, tx: Tx) {
  await tx.projectEntry.delete({ where: { id: entryId } });
}

export async function setMaterialChecked(projectId: string, materialId: string, checked: boolean) {
  const result = await db.projectMaterial.updateMany({
    where: { id: materialId, projectId },
    data: { checked },
  });
  return result.count > 0;
}
