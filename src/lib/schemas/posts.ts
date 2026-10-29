import { z } from "zod";

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/lib/constants/pagination";
import { MAX_POST_MEDIA, postTypeSchema } from "@/lib/schemas/admin";
import { experienceLevelSchema } from "@/lib/schemas/me";

// API contracts for posts and themes (API_SPECIFICATION §5).

export const postIdParamsSchema = z.object({ postId: z.string().min(1).max(40) });

export const themeSlugParamsSchema = z.object({ slug: z.string().min(1).max(120) });

export const postPageQuerySchema = z.object({
  cursor: z.string().max(500).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});
export type PostPageQuery = z.output<typeof postPageQuerySchema>;

/** Same caps as a post's materials and steps (admin schema: 50 each). */
const MAX_PROGRESS_ITEMS = 50;
const unique = <T>(values: T[]) => new Set(values).size === values.length;

/**
 * PUT /api/posts/{postId}/progress (POST-11/12): each list given replaces the stored one; a list
 * left out stays as it is.
 */
export const updatePostProgressSchema = z
  .object({
    checkedMaterialIds: z
      .array(z.string().min(1).max(40))
      .max(MAX_PROGRESS_ITEMS)
      .refine(unique, "Each material can only be listed once."),
    completedStepPositions: z
      .array(
        z
          .number()
          .int()
          .min(0)
          .max(MAX_PROGRESS_ITEMS - 1),
      )
      .max(MAX_PROGRESS_ITEMS)
      .refine(unique, "Each step can only be listed once."),
  })
  .partial();
export type UpdatePostProgressInput = z.output<typeof updatePostProgressSchema>;

// --- Own posts (P2-02, API_SPECIFICATION §9.1; CRT-01…13) -----------------------------------

export const MAX_OWN_POST_SKILLS = 5;
export const MAX_OWN_POST_TAGS = 10;
export const MAX_OWN_POST_ITEMS = 30;
export const TAG_MIN_LENGTH = 2;
export const TAG_MAX_LENGTH = 30;

const ownId = z.string().min(1).max(40);
const optionalOwnText = (max: number) => z.string().trim().max(max).nullable().optional();

const ownPostFields = {
  type: postTypeSchema,
  title: z.string().trim().min(1, "Add a title.").max(120),
  description: optionalOwnText(2_000),
  skillIds: z
    .array(ownId)
    .max(MAX_OWN_POST_SKILLS, `Choose up to ${MAX_OWN_POST_SKILLS} skills.`)
    .refine(unique, "Each skill can only be added once."),
  primarySkillId: ownId.nullable(),
  mediaIds: z
    .array(ownId)
    .max(MAX_POST_MEDIA, `A post can have up to ${MAX_POST_MEDIA} photos or videos.`)
    .refine(unique, "Each photo or video can only be added once."),
  tags: z
    .array(
      z
        .string()
        .trim()
        .min(1)
        .max(TAG_MAX_LENGTH + 1),
    )
    .max(MAX_OWN_POST_TAGS, `Add up to ${MAX_OWN_POST_TAGS} tags.`),
  difficulty: experienceLevelSchema.nullable(),
  estimatedMinutes: z.number().int().min(1).max(10_000).nullable(),
  materials: z
    .array(z.object({ name: z.string().trim().min(1).max(120), note: optionalOwnText(200) }))
    .max(MAX_OWN_POST_ITEMS, `Add up to ${MAX_OWN_POST_ITEMS} materials.`),
  steps: z
    .array(
      z.object({
        text: z.string().trim().min(1).max(1_000),
        mediaId: ownId.nullable().optional(),
      }),
    )
    .max(MAX_OWN_POST_ITEMS, `Add up to ${MAX_OWN_POST_ITEMS} steps.`),
};

/**
 * POST /api/me/posts: a draft starts with the first upload (F-17), so only the type is needed;
 * the title defaults to "Untitled" until the maker writes one.
 */
export const createOwnPostSchema = z.object({
  type: ownPostFields.type.default("FIRST_ATTEMPT"),
  title: ownPostFields.title.default("Untitled"),
  description: ownPostFields.description,
  skillIds: ownPostFields.skillIds.default([]),
  primarySkillId: ownPostFields.primarySkillId.default(null),
  mediaIds: ownPostFields.mediaIds.default([]),
  tags: ownPostFields.tags.default([]),
  difficulty: ownPostFields.difficulty.default(null),
  estimatedMinutes: ownPostFields.estimatedMinutes.default(null),
  materials: ownPostFields.materials.default([]),
  steps: ownPostFields.steps.default([]),
  /** The journal project it is shared from (JRN-05); the route checks it is the caller's. */
  projectId: ownId.nullable().default(null),
});
export type CreateOwnPostInput = z.output<typeof createOwnPostSchema>;

/** PATCH /api/me/posts/{id}: any subset; lists are replaced. */
export const updateOwnPostSchema = z.object(ownPostFields).partial();
export type UpdateOwnPostInput = z.output<typeof updateOwnPostSchema>;

/** POST /api/me/posts/{id}/publish: the own-work confirmation (CRT-08) is needed the first time. */
export const publishOwnPostSchema = z
  .object({ ownWorkConfirmed: z.boolean().default(false) })
  // An empty body (a later Share) means "no new confirmation".
  .default({ ownWorkConfirmed: false });
export type PublishOwnPostInput = z.output<typeof publishOwnPostSchema>;

export const ownPostListQuerySchema = postPageQuerySchema.extend({
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
});
export type OwnPostListQuery = z.output<typeof ownPostListQuerySchema>;

export const ownPostIdParamsSchema = z.object({ id: ownId });
