import type {
  AIFeedbackInput,
  ConsentsInput,
  PlanRequestInput,
  SendAIMessageInput,
} from "@/lib/schemas/ai";
import type {
  AIConsents,
  AIConversationDetail,
  AIConversationSummary,
  AIPlan,
  SendAIMessageResult,
} from "@/lib/types/ai";
import type { Paginated } from "@/lib/types/api";

import { postJson, requestJson } from "./request";

// AI companion (API_SPECIFICATION §9.2, P4-01).

export function sendAIMessage(input: SendAIMessageInput): Promise<SendAIMessageResult> {
  return postJson<SendAIMessageResult>("/api/ai/messages", input);
}

export function createAIPlan(input: PlanRequestInput): Promise<AIPlan> {
  return postJson<AIPlan>("/api/ai/plan", input);
}

export function listAIConversations(
  cursor?: string | null,
): Promise<Paginated<AIConversationSummary>> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return requestJson<Paginated<AIConversationSummary>>("GET", `/api/ai/conversations${query}`);
}

export function getAIConversation(id: string): Promise<AIConversationDetail> {
  return requestJson<AIConversationDetail>(
    "GET",
    `/api/ai/conversations/${encodeURIComponent(id)}`,
  );
}

export function deleteAIConversation(id: string): Promise<void> {
  return requestJson("DELETE", `/api/ai/conversations/${encodeURIComponent(id)}`);
}

export function sendAIFeedback(messageId: string, input: AIFeedbackInput): Promise<void> {
  return requestJson("PUT", `/api/ai/messages/${encodeURIComponent(messageId)}/feedback`, input);
}

export function updateAIConsents(input: ConsentsInput): Promise<AIConsents> {
  return requestJson<AIConsents>("PUT", "/api/me/consents", input);
}
