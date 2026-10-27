import type { ReportReason } from "@/lib/schemas/reports";

// Admin view of reports (API_SPECIFICATION §6b), grouped by what was reported.

export type ReportGroup = {
  /** Any report of the group; actions use it to find the target. */
  reportId: string;
  targetType: "SKILL" | "PROFILE";
  target: {
    /** Skill name or display name; null when the target no longer exists. */
    label: string | null;
    /** `/s/{slug}` or `/u/{username}` (opens only while visible). */
    href: string | null;
    detail: string | null;
    isHidden: boolean;
  };
  reportCount: number;
  reasons: Partial<Record<ReportReason, number>>;
  /** Notes from reporters, newest first (reporters are never shown, RPT-05). */
  notes: { reason: ReportReason; note: string; createdAt: string }[];
  latestAt: string;
  status: "OPEN" | "ACTIONED" | "DISMISSED";
};
