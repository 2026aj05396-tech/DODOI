"use client";

import { useEffect, useState } from "react";

import { getAIConversation } from "@/lib/api-client/ai";
import type { AIContextInput } from "@/lib/schemas/ai";
import type { AIConversationDetail, CompanionSetup } from "@/lib/types/ai";

import { ChatPanel } from "./chat-panel";
import { ChatSkeleton } from "./chat-skeleton";

// The companion docked on the right of a post or skill page from 1280px (`2c`, F-23 step 3). It
// keeps the chat about this page across reloads in this browser tab (sessionStorage); the full
// history stays in `/companion`.

const STORAGE_PREFIX = "dodoi:companion-dock:";

function readStored(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string | null) {
  try {
    if (value === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, value);
  } catch {
    // Private windows can refuse storage; the chat still works, it just isn't remembered.
  }
}

export function CompanionDock({
  setup,
  isVerified,
  context,
  title,
}: {
  setup: CompanionSetup;
  isVerified: boolean;
  context: AIContextInput;
  title: string;
}) {
  const storageKey = `${STORAGE_PREFIX}${context.type}:${context.id}`;
  // `undefined` while looking for an earlier chat, `null` when there is none.
  const [earlier, setEarlier] = useState<AIConversationDetail | null | undefined>(undefined);

  useEffect(() => {
    const id = readStored(storageKey);
    if (!id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reads the tab's storage, which the server can't.
      setEarlier(null);
      return;
    }
    let isCurrent = true;
    getAIConversation(id)
      .then((conversation) => isCurrent && setEarlier(conversation))
      .catch(() => {
        writeStored(storageKey, null);
        if (isCurrent) setEarlier(null);
      });
    return () => {
      isCurrent = false;
    };
  }, [storageKey]);

  return (
    <aside
      data-companion-dock
      aria-label="dodoi companion"
      className="sticky top-0 hidden h-dvh w-95 shrink-0 flex-col border-l border-border xl:flex"
    >
      {earlier === undefined ? (
        <ChatSkeleton />
      ) : (
        <ChatPanel
          key={earlier?.id ?? "new"}
          setup={setup}
          isVerified={isVerified}
          conversationId={earlier?.id ?? null}
          initialMessages={earlier?.messages ?? []}
          context={earlier?.context ?? { type: context.type, id: context.id, title }}
          newContext={context}
          variant="dock"
          onConversationStart={(id) => writeStored(storageKey, id)}
        />
      )}
    </aside>
  );
}
