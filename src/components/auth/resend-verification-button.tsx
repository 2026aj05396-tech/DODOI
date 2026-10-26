"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { resendVerificationEmail } from "@/lib/api-client/account";
import { ApiRequestError } from "@/lib/api-client/request";

type State = { status: "idle" | "sending" | "sent" } | { status: "failed"; message: string };

type ResendVerificationButtonProps = { size?: "md" | "lg" };

/** "Resend email" for a signed-in, unverified user (3 per hour); also used in the banner. */
export function ResendVerificationButton({ size = "lg" }: ResendVerificationButtonProps) {
  const [state, setState] = useState<State>({ status: "idle" });

  async function handleClick() {
    setState({ status: "sending" });
    try {
      await resendVerificationEmail();
      setState({ status: "sent" });
    } catch (error) {
      setState({
        status: "failed",
        message:
          error instanceof ApiRequestError
            ? error.message
            : "We couldn't send the email right now. Please try again in a few minutes.",
      });
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {state.status === "failed" ? <ErrorBanner>{state.message}</ErrorBanner> : null}
      {state.status === "sent" ? (
        <p role="status" className="text-body text-foreground-secondary">
          We&apos;ve sent a new link. It works once and expires in 24 hours.
        </p>
      ) : null}
      <Button
        variant="outline"
        size={size}
        onClick={handleClick}
        disabled={state.status === "sending"}
      >
        {state.status === "sent" ? "Send another email" : "Resend email"}
      </Button>
    </div>
  );
}
