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

/** A project plan (AIC-04): `skillId` is the dodoi skill the craft matched, when one did. */
export type AIPlan = {
  title: string;
  craft: string;
  skillId: string | null;
  materials: string[];
  steps: string[];
};

/** What the companion screens need when they render (AIC-06, AIC-07, F-23 step 4). */
export type CompanionSetup = {
  /** False while the companion is off: the screens show "The companion is resting". */
  isAvailable: boolean;
  /** True on the free tier (local and test): the chat shows the "Test version" notice. */
  showFreeTierNotice: boolean;
  consents: AIConsents;
  /** Real dodoi skills; exact names in an answer become links to `/s/{slug}`. */
  skills: { id: string; name: string; slug: string }[];
};
