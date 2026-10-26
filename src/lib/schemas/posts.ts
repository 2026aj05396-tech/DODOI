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
