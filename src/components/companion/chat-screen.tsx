"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";

import { ChatPanel, type ChatPanelProps } from "./chat-panel";

/**
 * The full-screen chat (`1f`). When a new chat gets its first answer the address becomes
 * `/companion/{id}` without reloading, so a refresh or shared link reopens the same chat. Going to
 * any other address afterwards (New chat, another chat) starts the panel afresh: the page's tree
 * is the same one, so without this the old messages would stay on screen.
 */
export function ChatScreen(props: Omit<ChatPanelProps, "variant" | "onConversationStart">) {
  const address = `${usePathname()}?${useSearchParams()}`;
  const [ownAddress, setOwnAddress] = useState<string | null>(null);
  const [lastAddress, setLastAddress] = useState(address);
  const [instance, setInstance] = useState(0);

  if (address !== lastAddress) {
    setLastAddress(address);
    if (address !== ownAddress) setInstance((current) => current + 1);
  }

  return (
    <ChatPanel
      key={instance}
      {...props}
      variant="page"
      onConversationStart={(id) => {
        const path = `/companion/${id}`;
        setOwnAddress(`${path}?`);
        window.history.replaceState(null, "", path);
      }}
    />
  );
}
