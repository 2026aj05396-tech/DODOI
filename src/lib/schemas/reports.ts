import { z } from "zod";

// Reports API contracts (API_SPECIFICATION §6b, RPT-01…05).

export const reportReasonSchema = z.enum(["OFFENSIVE", "SPAM", "IMPERSONATION", "OTHER"]);
export type ReportReason = z.output<typeof reportReasonSchema>;

/**
 * POST /api/reports. `targetId` is the skill id for a SKILL and the **username** for a PROFILE
 * (public profiles never show internal ids, PRF-08).
 */
export const createReportSchema = z.object({
  targetType: z.enum(["SKILL", "PROFILE"]),
  targetId: z.string().trim().min(1).max(40),
  reason: reportReasonSchema,
  /** Optional; an empty note is the same as none. */
  note: z.string().trim().max(500, "Keep the note to 500 characters or fewer.").optional(),
});
export type CreateReportInput = z.output<typeof createReportSchema>;

export const adminReportsQuerySchema = z.object({
  status: z.enum(["OPEN", "RESOLVED"]).default("OPEN"),
  cursor: z.string().max(500).optional(),
});
export type AdminReportsQuery = z.output<typeof adminReportsQuerySchema>;

/** Acts on every open report about the same target (PO decision, P1-28b). */
export const reportActionSchema = z.object({
  action: z.enum(["HIDE_TARGET", "DISMISS", "RESTORE_TARGET"]),
});
export type ReportActionInput = z.output<typeof reportActionSchema>;
