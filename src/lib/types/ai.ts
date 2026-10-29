import type { Media } from "@/lib/types/media";

// AI companion views returned by the API (API_SPECIFICATION §9.2, P4-01).

export type AIContextTypeName = "NONE" | "POST" | "SKILL";

/** The post or skill a conversation is about ("Looking at: …"); null when it is gone. */
export type AIContextView = { type: "POST" | "SKILL"; id: string; title: string } | null;

export type AIMessageView = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  /** The photo the user added to this message. */
  image: Media | null;
  status: "OK" | "BLOCKED" | "ERROR";
  feedback: { helpful: boolean } | null;
  createdAt: string;
};

export type AIConversationSummary = {
  id: string;
  title: string | null;
  contextType: AIContextTypeName;
  context: AIContextView;
  updatedAt: string;
};

export type AIConversationDetail = AIConversationSummary & { messages: AIMessageView[] };

export type SendAIMessageResult = {
  conversation: AIConversationSummary;
  userMessage: AIMessageView;
  assistantMessage: AIMessageView;
};

export type AIConsents = { AI_IMAGES: boolean; AI_PROFILE_CONTEXT: boolean };
