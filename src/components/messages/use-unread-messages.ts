"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { listConversations } from "@/lib/api-client/messages";

// The unread dot on Messages (MSG-01): checked about every 60 seconds while the tab is visible. It
// asks the same list the Messages screen shows, so there is one endpoint to keep right. The first
// check waits a few seconds so it never competes with the page that is still loading.

const UNREAD_POLL_MS = 60_000;
const FIRST_CHECK_DELAY_MS = 3_000;

export function useUnreadMessages(): boolean {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), FIRST_CHECK_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);
  const query = useQuery({
    queryKey: ["conversations", "unread"],
    queryFn: () => listConversations(),
    enabled: isReady,
    refetchInterval: UNREAD_POLL_MS,
    refetchIntervalInBackground: false,
    staleTime: UNREAD_POLL_MS / 2,
    retry: false,
  });
  return query.data?.items.some((item) => item.hasUnread) ?? false;
}
