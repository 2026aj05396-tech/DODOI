import { z } from "zod";

// API contracts for the creative journal (API_SPECIFICATION §9.1, P2-03; JRN-01…07).

export const MAX_PROJECTS = 100;
export const MAX_ENTRIES = 200;
export const MAX_ENTRY_PHOTOS = 4;

const id = z.string().min(1).max(40);
const unique = <T>(values: T[]) => new Set(values).size === values.length;

export const projectStatusSchema = z.enum(["IN_PROGRESS", "COMPLETED"]);
export const projectVisibilitySchema = z.enum(["PRIVATE", "PUBLIC"]);

const projectFields = {
  title: z.string().trim().min(1, "Give your project a name.").max(80),
  skillId: id.nullable(),
  status: projectStatusSchema,
  visibility: projectVisibilitySchema,
};

/** POST /api/me/projects: a name is enough; private and in progress by default. */
export const createProjectSchema = z.object({
  title: projectFields.title,
  skillId: projectFields.skillId.default(null),
  visibility: projectFields.visibility.default("PRIVATE"),
  /** The checklist of a plan from the companion (P4-03); empty for a plain project. */
  materials: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
});
export type CreateProjectInput = z.output<typeof createProjectSchema>;

/** PATCH /api/projects/{id}: rename, change the skill, mark complete / reopen, share or hide. */
export const updateProjectSchema = z.object(projectFields).partial();
export type UpdateProjectInput = z.output<typeof updateProjectSchema>;

const entryFields = {
  title: z.string().trim().max(80).nullable(),
  body: z.string().trim().max(2_000).nullable(),
  mediaIds: z
    .array(id)
    .max(MAX_ENTRY_PHOTOS, `An entry can have up to ${MAX_ENTRY_PHOTOS} photos.`)
    .refine(unique, "Each photo can only be added once."),
};

/** POST /api/projects/{id}/entries: a title, some text or a photo — at least one of them. */
export const createEntrySchema = z
  .object({
    title: entryFields.title.default(null),
    body: entryFields.body.default(null),
    mediaIds: entryFields.mediaIds.default([]),
  })
  .refine((entry) => entry.title || entry.body || entry.mediaIds.length > 0, {
    message: "Add a few words or a photo.",
    path: ["body"],
  });
export type CreateEntryInput = z.output<typeof createEntrySchema>;

export const updateEntrySchema = z.object(entryFields).partial();
export type UpdateEntryInput = z.output<typeof updateEntrySchema>;

export const materialCheckSchema = z.object({ checked: z.boolean() });
export type MaterialCheckInput = z.output<typeof materialCheckSchema>;

export const projectListQuerySchema = z.object({ status: projectStatusSchema.optional() });
export type ProjectListQuery = z.output<typeof projectListQuerySchema>;

export const projectIdParamsSchema = z.object({ id });
export const entryParamsSchema = z.object({ id, entryId: id });
export const materialParamsSchema = z.object({ id, materialId: id });
