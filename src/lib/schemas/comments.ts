import { z } from "zod";

// API contracts for comments (API_SPECIFICATION §9.1, P2-04; CMT-01…05).

export const MAX_COMMENT_LENGTH = 1_000;
/** Replies shown under a comment before "View more replies". */
export const INLINE_REPLY_COUNT = 3;

const id = z.string().min(1).max(40);

const commentBody = z
  .string()
  .trim()
  .min(1, "Write a comment first.")
  .max(MAX_COMMENT_LENGTH, `Comments can be up to ${MAX_COMMENT_LENGTH} characters.`);

export const commentIdParamsSchema = z.object({ id });

/** POST /api/posts/{postId}/comments: `parentId` makes it a reply (to a reply goes to its parent). */
export const createCommentSchema = z.object({
  body: commentBody,
  parentId: id.optional(),
});
export type CreateCommentInput = z.output<typeof createCommentSchema>;

/** PATCH /api/comments/{id}. */
export const updateCommentSchema = z.object({ body: commentBody });

/** Comments and replies load 20 at a time (CMT-04). */
export const commentPageQuerySchema = z.object({
  cursor: z.string().max(500).optional(),
});
export type CommentPageQuery = z.output<typeof commentPageQuerySchema>;
