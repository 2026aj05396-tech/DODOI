"use client";

import { getSession, signOut } from "next-auth/react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { FieldError } from "@/components/ui/field-error";
import { Input, Label } from "@/components/ui/input";
import { confirmAge } from "@/lib/api-client/account";
import { ApiRequestError } from "@/lib/api-client/request";
import { confirmAgeSchema } from "@/lib/schemas/auth";

type ConfirmAgeFormProps = { returnTo: string };

// Date-of-birth step after a first Google sign-in (AUTH-11; P1-07 restyles it). Under 18, the
// server deletes the account and this form signs the person out.
export function ConfirmAgeForm({ returnTo }: ConfirmAgeFormProps) {
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = confirmAgeSchema.safeParse({
      dateOfBirth: new FormData(event.currentTarget).get("dateOfBirth"),
    });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? null);
      return;
    }

    setFieldError(null);
    setFormError(null);
    setPending(true);
    try {
      await confirmAge(parsed.data);
    } catch (error) {
      setPending(false);
      if (error instanceof ApiRequestError && error.code === "UNDER_MINIMUM_AGE") {
        await signOut({ redirect: false });
        setBlocked(error.message);
        return;
      }
      if (error instanceof ApiRequestError && error.fields.dateOfBirth) {
        setFieldError(error.fields.dateOfBirth);
        return;
      }
      setFormError(error instanceof ApiRequestError ? error.message : null);
      return;
    }
    // Refresh the session cookie so the proxy sees the confirmed age, then continue.
    await getSession();
    window.location.assign(returnTo);
  }

  if (blocked) {
    return <ErrorBanner>{blocked}</ErrorBanner>;
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
      {formError ? <ErrorBanner>{formError}</ErrorBanner> : null}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirm-age-dob">Date of birth</Label>
        <Input
          id="confirm-age-dob"
          name="dateOfBirth"
          type="date"
          autoComplete="bday"
          aria-invalid={fieldError ? true : undefined}
          aria-describedby="confirm-age-hint confirm-age-error"
        />
        <p id="confirm-age-hint" className="text-meta text-foreground-secondary">
          dodoi is for adults. We only use this to check you&apos;re 18 or over, then discard it.
        </p>
        <FieldError id="confirm-age-error">{fieldError}</FieldError>
      </div>
      <Button type="submit" size="lg" disabled={pending}>
        Continue
      </Button>
    </form>
  );
}
