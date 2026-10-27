import { z } from "zod";

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/lib/constants/pagination";

// Saves and collections API contracts (API_SPECIFICATION §6, COLL-01…07, OD-17).

export const MAX_COLLECTIONS = 100;
export const MAX_COLLECTION_ITEMS = 1000;

const id = z.string().min(1).max(40);

export const collectionNameSchema = z
  .string()
  .trim()
  .min(1, "Give the collection a name.")
  .max(80, "Keep the name to 80 characters or fewer.");

export const collectionVisibilitySchema = z.enum(["PRIVATE", "PUBLIC"]);

export const createCollectionSchema = z.object({
  name: collectionNameSchema,
  visibility: collectionVisibilitySchema.default("PRIVATE"),
});
export type CreateCollectionInput = z.output<typeof createCollectionSchema>;

export const updateCollectionSchema = z
  .object({ name: collectionNameSchema, visibility: collectionVisibilitySchema })
  .partial();
export type UpdateCollectionInput = z.output<typeof updateCollectionSchema>;

export const collectionIdParamsSchema = z.object({ id });
export const collectionItemParamsSchema = z.object({ id, postId: id });

export const listPageQuerySchema = z.object({
  cursor: z.string().max(500).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});
export type ListPageQuery = z.output<typeof listPageQuerySchema>;
