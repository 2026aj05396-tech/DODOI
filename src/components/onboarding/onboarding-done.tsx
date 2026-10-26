"use client";

import { getSession } from "next-auth/react";
import { useEffect } from "react";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * Onboarding was already finished (e.g. on another device) but this browser's session cookie
 * still says otherwise: refresh it so the proxy stops sending the user here, then move on.
 */
export function OnboardingDone({ finishPath }: { finishPath: string }) {
  useEffect(() => {
    void getSession().then(() => window.location.replace(finishPath));
  }, [finishPath]);

  return (
    <div role="status" aria-label="Loading" className="mx-auto w-full max-w-3xl p-10">
      <Skeleton className="h-72 w-full rounded-md" />
    </div>
  );
}
