import { z } from "zod";

// API contracts for follows (API_SPECIFICATION §9.1, P2-06; FLW-01…04).

export const followUsernameParamsSchema = z.object({ username: z.string().min(1).max(60) });

export const followListQuerySchema = z.object({ cursor: z.string().max(500).optional() });
export type FollowListQuery = z.output<typeof followListQuerySchema>;
