"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { FieldError } from "@/components/ui/field-error";
import { Input, Label } from "@/components/ui/input";
import { confirmPasswordReset } from "@/lib/api-client/account";
import { ApiRequestError } from "@/lib/api-client/request";
import { newPasswordSchema, PASSWORD_MIN_LENGTH } from "@/lib/schemas/auth";

type ResetPasswordFormProps = { token: string | null };

type FieldErrors = { newPassword?: string; confirmPassword?: string };

// Opened from the reset email (F-04 step 3; P1-07 restyles it). Success signs out every session,
// so the person then signs in with the new password.
export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(
    token ? null : "This link is incomplete. Open the link from your email again.",
  );
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    const data = new FormData(event.currentTarget);
    const newPassword = String(data.get("newPassword") ?? "");
    const parsed = newPasswordSchema.safeParse(newPassword);
    if (!parsed.success) {
      setFieldErrors({ newPassword: parsed.error.issues[0]?.message });
      return;
    }
    if (data.get("confirmPassword") !== newPassword) {
      setFieldErrors({ confirmPassword: "The passwords don't match." });
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setPending(true);
    try {
      await confirmPasswordReset({ token, newPassword });
      setDone(true);
    } catch (error) {
      if (error instanceof ApiRequestError && error.fields.newPassword) {
        setFieldErrors({ newPassword: error.fields.newPassword });
      } else {
        setFormError(error instanceof ApiRequestError ? error.message : null);
      }
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="text-body text-foreground-secondary">
          Your password is set. For your security we&apos;ve signed you out on every device.
        </p>
        <Button asChild size="lg">
          <Link href="/sign-in">Sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form method="post" noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
      {formError ? <ErrorBanner>{formError}</ErrorBanner> : null}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reset-new-password">New password</Label>
        <Input
          id="reset-new-password"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          aria-invalid={fieldErrors.newPassword ? true : undefined}
          aria-describedby="reset-new-password-hint reset-new-password-error"
        />
        <p id="reset-new-password-hint" className="text-meta text-foreground-secondary">
          At least {PASSWORD_MIN_LENGTH} characters.
        </p>
        <FieldError id="reset-new-password-error">{fieldErrors.newPassword}</FieldError>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reset-confirm-password">Confirm new password</Label>
        <Input
          id="reset-confirm-password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          aria-invalid={fieldErrors.confirmPassword ? true : undefined}
          aria-describedby={
            fieldErrors.confirmPassword ? "reset-confirm-password-error" : undefined
          }
        />
        <FieldError id="reset-confirm-password-error">{fieldErrors.confirmPassword}</FieldError>
      </div>
      <Button type="submit" size="lg" disabled={pending || !token}>
        Save new password
      </Button>
      {formError && token ? (
        <Link href="/forgot-password" className="text-body font-bold text-link hover:underline">
          Send a new link
        </Link>
      ) : null}
    </form>
  );
}
