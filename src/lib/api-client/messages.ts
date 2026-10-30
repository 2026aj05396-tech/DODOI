import type { MessagePolicyName, SendMessageInput } from "@/lib/schemas/messages";
import type { Paginated } from "@/lib/types/api";
import type {
  ConversationSummary,
  MessagePage,
  MessagePerson,
  MessageSettings,
  MessageView,
  StartedConversation,
} from "@/lib/types/messages";

import { postJson, requestJson } from "./request";

// Direct messages (API_SPECIFICATION §9.3, P3-02).

export function listConversations(
  cursor: string | null = null,
): Promise<Paginated<ConversationSummary>> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return requestJson<Paginated<ConversationSummary>>("GET", `/api/conversations${query}`);
}

/** People you can message: suggestions without `q`, a search with it (MSG-06). */
export function listMessagePeople(
  q: string,
  cursor: string | null = null,
): Promise<Paginated<MessagePerson>> {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (cursor) params.set("cursor", cursor);
  const query = params.size > 0 ? `?${params}` : "";
  return requestJson<Paginated<MessagePerson>>("GET", `/api/conversations/people${query}`);
}

export function startConversation(username: string): Promise<StartedConversation> {
  return postJson<StartedConversation>("/api/conversations", { username });
}

/** The polling call (`after`) and "earlier messages" (`before`). */
export function listMessages(
  conversationId: string,
  range: { after?: string; before?: string },
): Promise<MessagePage> {
  const params = new URLSearchParams();
  if (range.after) params.set("after", range.after);
  if (range.before) params.set("before", range.before);
  const query = params.size > 0 ? `?${params}` : "";
  return requestJson<MessagePage>("GET", `/api/conversations/${conversationId}/messages${query}`);
}

export function sendMessage(conversationId: string, input: SendMessageInput): Promise<MessageView> {
  return postJson<MessageView>(`/api/conversations/${conversationId}/messages`, input);
}

export function deleteMessage(id: string): Promise<void> {
  return requestJson("DELETE", `/api/messages/${id}`);
}

export function hideConversation(id: string): Promise<void> {
  return requestJson("DELETE", `/api/conversations/${id}`);
}

export function getMessageSettings(): Promise<MessageSettings> {
  return requestJson<MessageSettings>("GET", "/api/me/message-settings");
}

export function updateMessageSettings(messagePolicy: MessagePolicyName): Promise<MessageSettings> {
  return requestJson<MessageSettings>("PUT", "/api/me/message-settings", { messagePolicy });
}
