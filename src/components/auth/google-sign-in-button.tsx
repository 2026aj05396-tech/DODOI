"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

/**
 * Google's "G" logo as required by its sign-in branding guidelines (P1-07 PO decision). These are
 * Google's brand colours, the one place raw colours appear outside tokens.css.
 */
function GoogleLogo() {
  return (
    <svg aria-hidden viewBox="0 0 18 18" className="size-3.5">
      <path
        fill="#EA4335"
        d="M9 3.48c1.69 0 2.83.73 3.48 1.34l2.54-2.48C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.96l2.91 2.26C4.6 5.05 6.62 3.48 9 3.48z"
      />
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.74-.06-1.28-.19-1.84H9v3.34h4.96c-.1.83-.64 2.08-1.84 2.92l2.84 2.2c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#FBBC05"
        d="M3.88 10.78A5.54 5.54 0 0 1 3.58 9c0-.62.11-1.22.29-1.78L.96 4.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l2.92-2.26z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.84-2.2c-.76.53-1.78.9-3.12.9-2.38 0-4.4-1.57-5.12-3.74L.97 13.04C2.45 15.98 5.48 18 9 18z"
      />
    </svg>
  );
}

type GoogleSignInButtonProps = {
  /** Safe in-app path to open afterwards (already checked on the server). */
  returnTo: string;
  variant?: "primary" | "outline";
  className?: string;
};

/** "Continue with Google" as on Welcome `1a`: coral pill with the logo in a paper circle. */
export function GoogleSignInButton({
  returnTo,
  variant = "primary",
  className,
}: GoogleSignInButtonProps) {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    // Through the date-of-birth step, which passes straight on once the age is confirmed (AUTH-11).
    await signIn("google", { redirectTo: `/confirm-age?returnTo=${encodeURIComponent(returnTo)}` });
  }

  return (
    <Button
      type="button"
      size="lg"
      variant={variant}
      onClick={handleClick}
      disabled={pending}
      className={cn("w-full", className)}
    >
      <span className="flex size-5 items-center justify-center rounded-full bg-background">
        <GoogleLogo />
      </span>
      Continue with Google
    </Button>
  );
}
