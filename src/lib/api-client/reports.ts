import type { CreateReportInput, ReportActionInput } from "@/lib/schemas/reports";
import type { Paginated } from "@/lib/types/api";
import type { ReportGroup } from "@/lib/types/reports";

import { postJson, requestJson } from "./request";

// Reports (API_SPECIFICATION §6b).

export function sendReport(input: CreateReportInput): Promise<unknown> {
  return postJson("/api/reports", input);
}

export function getReportGroups(
  status: "OPEN" | "RESOLVED",
  cursor?: string | null,
): Promise<Paginated<ReportGroup>> {
  const params = new URLSearchParams({ status });
  if (cursor) params.set("cursor", cursor);
  return requestJson<Paginated<ReportGroup>>("GET", `/api/admin/reports?${params}`);
}

export function actOnReport(reportId: string, input: ReportActionInput): Promise<void> {
  return postJson(`/api/admin/reports/${reportId}/action`, input);
}
