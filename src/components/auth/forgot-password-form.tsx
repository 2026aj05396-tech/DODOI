"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { FieldError } from "@/components/ui/field-error";
import { Input, Label } from "@/components/ui/input";
import { requestPasswordReset } from "@/lib/api-client/account";
import { ApiRequestError } from "@/lib/api-client/request";
import { passwordResetRequestSchema } from "@/lib/schemas/auth";

import { readRememberedEmail } from "./email-handoff";

// Forgot password (F-04; P1-06 minimal version, P1-07 restyles it). The answer is the same
// whether or not the email has an account (SECURITY_AND_PRIVACY §2.5).
export function ForgotPasswordForm() {
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  // Arriving from "Forgot password?" on sign-in: keep the email already typed there.
  useEffect(() => {
    const email = readRememberedEmail();
    if (email && emailRef.current) emailRef.current.value = email;
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = passwordResetRequestSchema.safeParse({
      email: new FormData(event.currentTarget).get("email"),
    });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? null);
      return;
    }

    setFieldError(null);
    setFormError(null);
    setPending(true);
    try {
      await requestPasswordReset(parsed.data);
      setSent(true);
    } catch (error) {
      setFormError(error instanceof ApiRequestError ? error.message : null);
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <p role="status" className="text-body text-foreground-secondary">
        If an account exists for this email, we&apos;ve sent a reset link. It works once and expires
        in 1 hour.
      </p>
    );
  }

  return (
    <form method="post" noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="text-body text-foreground-secondary">
        Enter your email and we&apos;ll send you a link to choose a new password. If you signed up
        with Google, this lets you add a password too.
      </p>
      {formError ? <ErrorBanner>{formError}</ErrorBanner> : null}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="forgot-email">Email</Label>
        <Input
          ref={emailRef}
          id="forgot-email"
          name="email"
          type="email"
          autoComplete="email"
          aria-invalid={fieldError ? true : undefined}
          aria-describedby={fieldError ? "forgot-email-error" : undefined}
        />
        <FieldError id="forgot-email-error">{fieldError}</FieldError>
      </div>
      <Button type="submit" size="lg" disabled={pending}>
        Send reset link
      </Button>
    </form>
  );
}
