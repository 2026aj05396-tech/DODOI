import { z } from "zod";

// API contracts for help requests (API_SPECIFICATION §9.3, P3-03; HLP-01…06).

export const HELP_TITLE_MAX = 100;
export const HELP_BODY_MAX = 1_000;
export const HELP_MAX_PHOTOS = 3;
export const HELP_RESPONSE_MAX = 1_000;

const id = z.string().min(1).max(40);
const unique = <T>(values: T[]) => new Set(values).size === values.length;

export const helpStatusSchema = z.enum(["OPEN", "IN_PROGRESS", "RESOLVED"]);
export type HelpStatusName = z.output<typeof helpStatusSchema>;

/** POST /api/help-requests: a title, the details, one skill and up to 3 photos (HLP-01). */
export const createHelpRequestSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Give your question a short title.")
    .max(HELP_TITLE_MAX, `Keep the title to ${HELP_TITLE_MAX} characters or fewer.`),
  body: z
    .string()
    .trim()
    .min(1, "Tell makers what you need help with.")
    .max(HELP_BODY_MAX, `Keep the details to ${HELP_BODY_MAX} characters or fewer.`),
  skillId: id,
  mediaIds: z
    .array(id)
    .max(HELP_MAX_PHOTOS, `A request can have up to ${HELP_MAX_PHOTOS} photos.`)
    .refine(unique, "Each photo can only be added once.")
    .default([]),
});
export type CreateHelpRequestInput = z.output<typeof createHelpRequestSchema>;

const flag = z
  .enum(["true", "false"])
  .transform((value) => value === "true")
  .optional();

/** GET /api/help-requests: open ones by default; `matching` limits to the member's can-help skills. */
export const helpListQuerySchema = z.object({
  status: helpStatusSchema.optional(),
  skillId: id.optional(),
  matching: flag,
  mine: flag,
  cursor: z.string().max(500).optional(),
});
export type HelpListQuery = z.output<typeof helpListQuerySchema>;

export const updateHelpRequestSchema = z.object({ status: helpStatusSchema });
export type UpdateHelpRequestInput = z.output<typeof updateHelpRequestSchema>;

export const createHelpResponseSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Write a few words first.")
    .max(HELP_RESPONSE_MAX, `Keep it to ${HELP_RESPONSE_MAX} characters or fewer.`),
});
export type CreateHelpResponseInput = z.output<typeof createHelpResponseSchema>;

export const helpIdParamsSchema = z.object({ id });
