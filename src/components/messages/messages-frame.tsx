"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

import { ConversationList } from "./conversation-list";

/**
 * The `/messages` screens (F-29 step 2). From 1280px: the list on the left, the conversation on the
 * right. Below that, `/messages` is the list and a conversation takes the whole screen.
 */
export function MessagesFrame({ children }: { children: ReactNode }) {
  const isList = usePathname() === "/messages";
  return (
    <div className="flex min-h-dvh">
      <ConversationList
        className={cn(
          "min-w-0 flex-1 xl:w-80 xl:flex-none xl:border-r xl:border-border",
          isList ? "mx-auto max-w-2xl xl:mx-0 xl:max-w-none" : "hidden xl:flex",
        )}
      />
      <div className={cn("min-w-0 flex-1 flex-col", isList ? "hidden xl:flex" : "flex")}>
        {children}
      </div>
    </div>
  );
}
