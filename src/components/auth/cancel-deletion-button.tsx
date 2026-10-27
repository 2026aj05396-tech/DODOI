"use client";

import { useRouter } from "next/navigation";
import { getSession } from "next-auth/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { cancelAccountDeletion } from "@/lib/api-client/account";
import { ApiRequestError } from "@/lib/api-client/request";

/** Reactivates a deactivated account (P1-28) and continues to the feed. */
export function CancelDeletionButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setError(null);
    try {
      await cancelAccountDeletion();
    } catch (failure) {
      setPending(false);
      setError(
        failure instanceof ApiRequestError
          ? failure.message
          : "We couldn't cancel the deletion. Try again.",
      );
      return;
    }
    // Refresh the session cookie first so the proxy stops sending every page here.
    await getSession();
    router.replace("/feed");
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? <ErrorBanner>{error}</ErrorBanner> : null}
      <Button size="lg" onClick={handleClick} disabled={pending} className="w-full">
        {pending ? "Cancelling…" : "Cancel deletion"}
      </Button>
    </div>
  );
}
