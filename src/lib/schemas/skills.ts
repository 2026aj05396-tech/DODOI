import { z } from "zod";

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/lib/constants/pagination";

// API contracts for skills (API_SPECIFICATION §4). Detailed name rules are enforced by the skills
// service after normalisation; this schema only bounds the raw input.

export const listSkillsQuerySchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  origin: z.enum(["PREDEFINED", "CUSTOM"]).optional(),
  cursor: z.string().max(500).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});
export type ListSkillsQuery = z.output<typeof listSkillsQuerySchema>;

export const createCustomSkillInputSchema = z.object({
  name: z.string().max(200),
});
export type CreateCustomSkillInput = z.output<typeof createCustomSkillInputSchema>;

export const skillSlugParamsSchema = z.object({
  slug: z.string().min(1).max(120),
});
