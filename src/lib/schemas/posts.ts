import { z } from "zod";

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/lib/constants/pagination";

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
