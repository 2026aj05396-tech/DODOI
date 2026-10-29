import { z } from "zod";

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/lib/constants/pagination";

// Feed API contracts (API_SPECIFICATION §5, FEED-13).

/** `for-you` · `following` · `new-to-you` · `skill:<slug>` (one of the user's interests). */
export const feedFilterSchema = z.union([
  z.literal("for-you"),
  z.literal("following"),
  z.literal("new-to-you"),
  z.string().startsWith("skill:").min(7).max(100),
]);
export type FeedFilter = z.output<typeof feedFilterSchema>;

export const feedQuerySchema = z.object({
  filter: feedFilterSchema.default("for-you"),
  cursor: z.string().max(500).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});
export type FeedQuery = z.output<typeof feedQuerySchema>;

export const feedFeedbackSchema = z.object({
  postId: z.string().min(1).max(40),
  type: z.literal("NOT_INTERESTED"),
});
export type FeedFeedbackInput = z.output<typeof feedFeedbackSchema>;
