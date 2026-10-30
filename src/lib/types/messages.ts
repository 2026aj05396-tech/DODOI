import type { MessagePolicyName } from "@/lib/schemas/messages";
import type { CreatorSummary } from "@/lib/types/posts";

// Message views returned by the API (API_SPECIFICATION §9.3, P3-02). Nothing here says whether the
// other person has read a message: there are no "seen" receipts (MSG-04).

export type { MessagePolicyName };

export type ConversationSummary = {
  id: string;
  /** The other person; null when their profile is hidden or gone. */
  with: CreatorSummary | null;
  lastMessage: {
    /** Null once deleted ("Message deleted"). */
    body: string | null;
    isOwn: boolean;
    createdAt: string;
  } | null;
  lastMessageAt: string;
  /** A message from them arrived since you last opened it. */
  hasUnread: boolean;
};

export type MessageView = {
  id: string;
  /** Null once the sender deleted it. */
  body: string | null;
  isOwn: boolean;
  isDeleted: boolean;
  createdAt: string;
  /** Pass as `after` to get what came next, or as `before` to get what came earlier. */
  cursor: string;
};

export type ConversationDetail = {
  id: string;
  with: CreatorSummary | null;
  /** Whether you may still write: false once they closed messages and never wrote back. */
  canSend: boolean;
  messages: MessageView[];
  /** Pass as `before` to load earlier messages; null when there are none. */
  olderCursor: string | null;
};

export type MessagePage = { items: MessageView[]; olderCursor: string | null };

export type StartedConversation = { id: string; created: boolean };

export type MessageSettings = { messagePolicy: MessagePolicyName };
