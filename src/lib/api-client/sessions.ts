import type { ProposeSessionInput } from "@/lib/schemas/sessions";
import type { Paginated } from "@/lib/types/api";
import type { SessionView } from "@/lib/types/sessions";

import { postJson, requestJson } from "./request";

// Creative sessions (API_SPECIFICATION §9.3, P3-04).

export function listSessions(
  scope: "upcoming" | "past",
  cursor: string | null = null,
): Promise<Paginated<SessionView>> {
  const params = new URLSearchParams({ scope });
  if (cursor) params.set("cursor", cursor);
  return requestJson<Paginated<SessionView>>("GET", `/api/sessions?${params}`);
}

export function proposeSession(
  input: Omit<ProposeSessionInput, "note" | "helpRequestId"> & {
    note?: string;
    helpRequestId?: string;
  },
): Promise<SessionView> {
  return postJson<SessionView>("/api/sessions", input);
}

export function respondToSession(
  id: string,
  action:
    | { action: "ACCEPT" | "DECLINE" | "CANCEL" }
    | { action: "RESCHEDULE"; startsAt: string; meetingUrl?: string },
): Promise<SessionView> {
  return requestJson<SessionView>("PATCH", `/api/sessions/${id}`, action);
}
