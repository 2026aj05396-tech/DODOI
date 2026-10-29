import { z } from "zod";

// API contracts for blocking and moderator roles (API_SPECIFICATION §9.1, P2-08; MOD-02, MOD-03).

export const blockUsernameParamsSchema = z.object({ username: z.string().min(1).max(60) });

export const blockListQuerySchema = z.object({ cursor: z.string().max(500).optional() });
export type BlockListQuery = z.output<typeof blockListQuerySchema>;

export const userIdParamsSchema = z.object({ id: z.string().min(1).max(40) });

/** PATCH /api/admin/users/{id}/role: admins hand the Moderator role out and take it back. */
export const updateRoleSchema = z.object({ role: z.enum(["USER", "MODERATOR"]) });
