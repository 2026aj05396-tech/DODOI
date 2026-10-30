import type {
  CreateHelpRequestInput,
  CreateHelpResponseInput,
  HelpStatusName,
} from "@/lib/schemas/help";
import type { Paginated } from "@/lib/types/api";
import type { HelpRequestCard, HelpRequestDetail } from "@/lib/types/help";

import { postJson, requestJson } from "./request";

// Help requests (API_SPECIFICATION §9.3, P3-03).

export type HelpListFilter = {
  status?: HelpStatusName;
  mine?: boolean;
  cursor?: string | null;
};

export function listHelpRequests(filter: HelpListFilter): Promise<Paginated<HelpRequestCard>> {
  const params = new URLSearchParams();
  if (filter.status) params.set("status", filter.status);
  if (filter.mine) params.set("mine", "true");
  if (filter.cursor) params.set("cursor", filter.cursor);
  const query = params.size > 0 ? `?${params}` : "";
  return requestJson<Paginated<HelpRequestCard>>("GET", `/api/help-requests${query}`);
}

export function createHelpRequest(
  input: Omit<CreateHelpRequestInput, "mediaIds"> & { mediaIds?: string[] },
): Promise<HelpRequestDetail> {
  return postJson<HelpRequestDetail>("/api/help-requests", input);
}

export function setHelpRequestStatus(
  id: string,
  status: HelpStatusName,
): Promise<HelpRequestDetail> {
  return requestJson<HelpRequestDetail>("PATCH", `/api/help-requests/${id}`, { status });
}

export function deleteHelpRequest(id: string): Promise<void> {
  return requestJson("DELETE", `/api/help-requests/${id}`);
}

export function createHelpResponse(
  id: string,
  input: CreateHelpResponseInput,
): Promise<HelpRequestDetail> {
  return postJson<HelpRequestDetail>(`/api/help-requests/${id}/responses`, input);
}

export function setResponseHelpful(id: string, isHelpful: boolean): Promise<void> {
  return requestJson(isHelpful ? "PUT" : "DELETE", `/api/help-responses/${id}/helpful`);
}
