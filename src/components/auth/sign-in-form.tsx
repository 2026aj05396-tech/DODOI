"use client";

import { signIn } from "next-auth/react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { FieldError } from "@/components/ui/field-error";
import { Input, Label } from "@/components/ui/input";
import { signInSchema } from "@/lib/schemas/auth";

import { toSignInErrorMessage } from "./sign-in-messages";

type SignInFormProps = {
  /** Safe in-app path to open after signing in (already checked on the server). */
  returnTo: string;
  /** Error reported by Auth.js in the URL, e.g. after a refused Google sign-in. */
  initialError: string | null;
};

type FieldErrors = { email?: string; password?: string };

// Minimal sign-in for P1-04 so both providers can be tested end to end. P1-07 restyles this
// screen to the design (Welcome `1a`, sign-in) and adds the sign-up and password-reset links.
export function SignInForm({ returnTo, initialError }: SignInFormProps) {
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(initialError);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const parsed = signInSchema.safeParse({
      email: data.get("email"),
      password: data.get("password"),
    });
    if (!parsed.success) {
      const errors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === "email" || field === "password") errors[field] ??= issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setPending(true);
    try {
      const result = await signIn("credentials", { ...parsed.data, redirect: false });
      if (result.error) {
        setFormError(toSignInErrorMessage(result.error, result.code));
        setPending(false);
        return;
      }
    } catch {
      // Network failure: show the generic message.
      setFormError(toSignInErrorMessage("Unknown"));
      setPending(false);
      return;
    }
    // Full navigation so every server component renders with the new session.
    window.location.assign(returnTo);
  }

  async function handleGoogle() {
    setPending(true);
    await signIn("google", { redirectTo: returnTo });
  }

  return (
    <div className="flex flex-col gap-5">
      {formError ? <ErrorBanner>{formError}</ErrorBanner> : null}

      <Button size="lg" onClick={handleGoogle} disabled={pending}>
        Continue with Google
      </Button>

      <p className="text-center text-meta text-foreground-secondary">or use your email</p>

      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sign-in-email">Email</Label>
          <Input
            id="sign-in-email"
            name="email"
            type="email"
            autoComplete="email"
            aria-invalid={fieldErrors.email ? true : undefined}
            aria-describedby={fieldErrors.email ? "sign-in-email-error" : undefined}
          />
          <FieldError id="sign-in-email-error">{fieldErrors.email}</FieldError>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sign-in-password">Password</Label>
          <Input
            id="sign-in-password"
            name="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={fieldErrors.password ? true : undefined}
            aria-describedby={fieldErrors.password ? "sign-in-password-error" : undefined}
          />
          <FieldError id="sign-in-password-error">{fieldErrors.password}</FieldError>
        </div>
        <Button type="submit" variant="outline" size="lg" disabled={pending}>
          Sign in
        </Button>
      </form>
    </div>
  );
}
