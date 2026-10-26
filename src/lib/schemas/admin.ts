import { z } from "zod";

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/lib/constants/pagination";
import { experienceLevelSchema } from "@/lib/schemas/me";

// Admin API contracts (API_SPECIFICATION §8). These check shape and lengths; publish rules
// (media, alt text, attribution) are checked by the content service.

/** PO decision (P1-16): up to 10 media per post, images and videos mixed. */
export const MAX_POST_MEDIA = 10;
const MAX_POST_SKILLS = 10;
const MAX_MATERIALS = 50;
const MAX_STEPS = 50;

const id = z.string().min(1).max(40);
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

export const postTypeSchema = z.enum([
  "FIRST_ATTEMPT",
  "TUTORIAL",
  "WORK_IN_PROGRESS",
  "JOURNAL",
  "FINISHED",
  "TIP",
]);

export const seedSourceTypeSchema = z.enum([
  "TEAM_ORIGINAL",
  "INVITED_CREATOR",
  "STOCK_LICENSED",
  "CREATIVE_COMMONS",
]);

export const attributionInputSchema = z.object({
  sourceType: seedSourceTypeSchema,
  license: z.string().trim().min(1, "Add the licence.").max(100),
  attributionText: z.string().trim().min(1, "Add the attribution text.").max(300),
  originalAuthor: optionalText(120),
  originalUrl: z.url("Use a full link, starting with https://").max(500).nullable().optional(),
  permissionRef: optionalText(200),
});
export type AttributionInput = z.output<typeof attributionInputSchema>;

const unique = <T>(values: T[]) => new Set(values).size === values.length;

const postFields = {
  type: postTypeSchema,
  title: z.string().trim().min(1, "Add a title.").max(120),
  description: optionalText(10_000),
  skillIds: z.array(id).max(MAX_POST_SKILLS).refine(unique, "Each skill can only be added once."),
  primarySkillId: id.nullable(),
  mediaIds: z
    .array(id)
    .max(MAX_POST_MEDIA, `A post can have up to ${MAX_POST_MEDIA} photos or videos.`)
    .refine(unique, "Each photo or video can only be added once."),
  difficulty: experienceLevelSchema.nullable(),
  estimatedMinutes: z.number().int().min(1).max(10_000).nullable(),
  materials: z
    .array(z.object({ name: z.string().trim().min(1).max(120), note: optionalText(200) }))
    .max(MAX_MATERIALS),
  steps: z
    .array(
      z.object({ text: z.string().trim().min(1).max(5_000), mediaId: id.nullable().optional() }),
    )
    .max(MAX_STEPS),
  attribution: attributionInputSchema.nullable(),
  /** Invited creators only: the dodoi account shown as the post's creator. */
  authorUsername: z.string().trim().min(1).max(20).nullable(),
};

/** POST /api/admin/posts: a draft needs only a type and title. */
export const createAdminPostSchema = z.object({
  type: postFields.type,
  title: postFields.title,
  description: postFields.description,
  skillIds: postFields.skillIds.default([]),
  primarySkillId: postFields.primarySkillId.default(null),
  mediaIds: postFields.mediaIds.default([]),
  difficulty: postFields.difficulty.default(null),
  estimatedMinutes: postFields.estimatedMinutes.default(null),
  materials: postFields.materials.default([]),
  steps: postFields.steps.default([]),
  attribution: postFields.attribution.default(null),
  authorUsername: postFields.authorUsername.default(null),
});
export type CreateAdminPostInput = z.output<typeof createAdminPostSchema>;

/** PATCH /api/admin/posts/{id}: any subset; lists (skills, media, steps, materials) are replaced. */
export const updateAdminPostSchema = z.object(postFields).partial();
export type UpdateAdminPostInput = z.output<typeof updateAdminPostSchema>;

export const adminPostListQuerySchema = z.object({
  status: z.enum(["DRAFT", "PUBLISHED", "UNPUBLISHED"]).optional(),
  skillId: id.optional(),
  sourceType: seedSourceTypeSchema.optional(),
  cursor: z.string().max(500).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});
export type AdminPostListQuery = z.output<typeof adminPostListQuerySchema>;

export const adminIdParamsSchema = z.object({ id });

const slug = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes.");

const themeFields = {
  slug,
  title: z.string().trim().min(1, "Add a title.").max(120),
  description: optionalText(1_000),
  coverMediaId: id.nullable().optional(),
  isPublished: z.boolean(),
  position: z.number().int().min(0).max(10_000),
  /** The theme's posts in display order (replaces the list). */
  postIds: z.array(id).max(200).refine(unique, "Each post can only be added once."),
};

export const createAdminThemeSchema = z.object({
  ...themeFields,
  isPublished: themeFields.isPublished.default(false),
  position: themeFields.position.default(0),
  postIds: themeFields.postIds.default([]),
});
export type CreateAdminThemeInput = z.output<typeof createAdminThemeSchema>;

export const updateAdminThemeSchema = z.object(themeFields).partial();
export type UpdateAdminThemeInput = z.output<typeof updateAdminThemeSchema>;

/** PATCH /api/admin/skills/{id}: editorial fields and visibility (any skill can be hidden). */
export const updateAdminSkillSchema = z
  .object({
    description: optionalText(1_000),
    hint: optionalText(40),
    pitch: optionalText(140),
    coverMediaId: id.nullable(),
    status: z.enum(["ACTIVE", "HIDDEN"]),
  })
  .partial();
export type UpdateAdminSkillInput = z.output<typeof updateAdminSkillSchema>;

export const setRelatedSkillsSchema = z.object({
  skillIds: z.array(id).max(20).refine(unique, "Each skill can only be added once."),
});
export type SetRelatedSkillsInput = z.output<typeof setRelatedSkillsSchema>;

// --- Seed content import (P1-18) -------------------------------------------------------------

/** A local photo or video, relative to the seed folder, e.g. "media/bee-1.jpg". */
const seedMediaFileSchema = z.object({
  path: z.string().trim().min(1).max(300),
  altText: optionalText(300),
});
export type SeedMediaFile = z.output<typeof seedMediaFileSchema>;

const skillSlug = z.string().trim().min(1).max(80);

/**
 * `seed-content/posts/<seedKey>.json` (API_SPECIFICATION §8): the admin post body, with skills by
 * slug (ids differ per environment), local files instead of media ids, required attribution
 * (ADM-03) and whether to publish. Unknown keys are rejected so typos don't pass silently.
 */
export const seedPostFileSchema = z
  .object({
    seedKey: slug,
    publish: z.boolean().default(false),
    type: postFields.type,
    title: postFields.title,
    description: postFields.description,
    skills: z
      .array(skillSlug)
      .min(1, "Add at least one skill.")
      .max(MAX_POST_SKILLS)
      .refine(unique, "Each skill can only be added once."),
    primarySkill: skillSlug,
    mediaFiles: z
      .array(seedMediaFileSchema)
      .min(1, "Add at least one photo or video.")
      .max(MAX_POST_MEDIA, `A post can have up to ${MAX_POST_MEDIA} photos or videos.`),
    difficulty: postFields.difficulty.default(null),
    estimatedMinutes: postFields.estimatedMinutes.default(null),
    materials: postFields.materials.default([]),
    steps: z
      .array(
        z
          .object({
            text: z.string().trim().min(1).max(5_000),
            mediaFile: seedMediaFileSchema.nullable().optional(),
          })
          .strict(),
      )
      .max(MAX_STEPS)
      .default([]),
    attribution: attributionInputSchema,
    authorUsername: postFields.authorUsername.default(null),
  })
  .strict()
  .refine((file) => file.skills.includes(file.primarySkill), {
    path: ["primarySkill"],
    message: "The main skill must be one of the post's skills.",
  });
export type SeedPostFile = z.output<typeof seedPostFileSchema>;
