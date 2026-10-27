import { z } from "zod";

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/lib/constants/pagination";

// Search API contract (API_SPECIFICATION §5, SRCH-01…03).

export const searchTypeSchema = z.enum(["all", "posts", "skills", "creators"]);
export type SearchType = z.output<typeof searchTypeSchema>;

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1, "Type something to search for.").max(100),
  type: searchTypeSchema.default("all"),
  cursor: z.string().max(500).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});
export type SearchQuery = z.output<typeof searchQuerySchema>;
