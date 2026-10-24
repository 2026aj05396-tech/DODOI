"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { resendVerificationEmail, verifyEmail } from "@/lib/api-client/account";
import { ApiRequestError } from "@/lib/api-client/request";

type VerifyEmailPanelProps = {
  token: string | null;
  /** Signed-in users can ask for a new link when this one has expired. */
  signedIn: boolean;
};

type State = "idle" | "pending" | "verified" | "failed" | "resent";

// The email link opens this page; the token is only used when the person presses the button,
// so link scanners that open URLs in emails cannot use it up (P1-05; P1-07 restyles it).
export function VerifyEmailPanel({ token, signedIn }: VerifyEmailPanelProps) {
  const [state, setState] = useState<State>(token ? "idle" : "failed");
  const [message, setMessage] = useState<string | null>(
    token ? null : "This link is incomplete. Open the link from your email again.",
  );

  async function handleVerify() {
    if (!token) return;
    setState("pending");
    try {
      await verifyEmail({ token });
      setState("verified");
    } catch (error) {
      setMessage(error instanceof ApiRequestError ? error.message : null);
      setState("failed");
    }
  }

  async function handleResend() {
    setState("pending");
    try {
      await resendVerificationEmail();
      setState("resent");
    } catch (error) {
      setMessage(error instanceof ApiRequestError ? error.message : null);
      setState("failed");
    }
  }

  if (state === "verified") {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-body text-foreground-secondary">
          Your email is confirmed. You can now share with the community.
        </p>
        <Button asChild size="lg">
          <Link href={signedIn ? "/" : "/sign-in"}>{signedIn ? "Continue" : "Sign in"}</Link>
        </Button>
      </div>
    );
  }

  if (state === "resent") {
    return (
      <p className="text-body text-foreground-secondary">
        We&apos;ve sent a new link. It works once and expires in 24 hours.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {state === "failed" ? (
        <ErrorBanner>{message ?? "This link has expired or was already used."}</ErrorBanner>
      ) : (
        <p className="text-body text-foreground-secondary">
          Press the button to confirm this is your email address.
        </p>
      )}
      {state === "failed" ? (
        signedIn ? (
          <Button size="lg" onClick={handleResend}>
            Send a new link
          </Button>
        ) : (
          <Button asChild variant="outline" size="lg">
            <Link href="/sign-in">Sign in to get a new link</Link>
          </Button>
        )
      ) : (
        <Button size="lg" onClick={handleVerify} disabled={state === "pending"}>
          Confirm my email
        </Button>
      )}
    </div>
  );
}
