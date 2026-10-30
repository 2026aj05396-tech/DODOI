import type { ReportReason } from "@/lib/schemas/reports";

// Admin view of reports (API_SPECIFICATION §6b), grouped by what was reported.

export type ReportGroup = {
  /** Any report of the group; actions use it to find the target. */
  reportId: string;
  targetType:
    | "SKILL"
    | "PROFILE"
    | "POST"
    | "COMMENT"
    | "AI_MESSAGE"
    | "HELP_REQUEST"
    | "HELP_RESPONSE"
    | "COMMUNITY"
    | "COMMUNITY_POST";
  target: {
    /** Skill name, display name, post title, the start of a comment or of an AI answer; null when it no longer exists. */
    label: string | null;
    /** `/s/{slug}`, `/u/{username}` or `/p/{id}` (a comment opens at its post). */
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
