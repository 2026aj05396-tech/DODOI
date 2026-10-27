"use client";

import { CloudOff, Wifi } from "lucide-react";
import { useEffect, useState } from "react";

import { useIsOnline } from "@/hooks/use-is-online";
import { cn } from "@/lib/utils/cn";

// Offline banner (USER_FLOWS F-13, PWA-06). Not designed: built from the design system (DC-11),
// in the toast's ink pill. Stays while offline; on reconnect says "Back online" and goes away.
// React Query refetches on reconnect by itself, so failed loads are retried.

const BACK_ONLINE_MS = 4000;

export function OfflineBanner() {
  const isOnline = useIsOnline();
  const [showBackOnline, setShowBackOnline] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    function onOnline() {
      setShowBackOnline(true);
      clearTimeout(timer);
      timer = setTimeout(() => setShowBackOnline(false), BACK_ONLINE_MS);
    }
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("online", onOnline);
      clearTimeout(timer);
    };
  }, []);

  const message = !isOnline
    ? "You're offline. Some things won't work until you reconnect."
    : showBackOnline
      ? "Back online"
      : null;

  return (
    // The live region is always there, so screen readers announce each change. It has nothing to
    // click, so clicks go through to the header underneath.
    <div
      role="status"
      className="pointer-events-none fixed inset-x-4 top-3 z-50 flex justify-center"
    >
      {message ? (
        <p
          className={cn(
            "flex max-w-md animate-dd-up items-center gap-2.5 rounded-card px-4 py-2.5 text-control shadow-float",
            isOnline ? "bg-mint text-foreground" : "bg-inverse text-inverse-foreground",
          )}
        >
          {isOnline ? (
            <Wifi aria-hidden className="size-4 shrink-0" />
          ) : (
            <CloudOff aria-hidden className="size-4 shrink-0" />
          )}
          {message}
        </p>
      ) : null}
    </div>
  );
}
