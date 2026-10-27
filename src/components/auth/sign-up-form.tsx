"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { FieldError } from "@/components/ui/field-error";
import { Input, Label } from "@/components/ui/input";
import { registerAccount } from "@/lib/api-client/account";
import { ApiRequestError } from "@/lib/api-client/request";
import { PASSWORD_MIN_LENGTH, registerSchema } from "@/lib/schemas/auth";

import { rememberEmailForSignIn } from "./email-handoff";
import { firstIssuePerField } from "./form-errors";
import { GoogleSignInButton } from "./google-sign-in-button";
import { ResendVerificationButton } from "./resend-verification-button";

const FIELDS = ["email", "password", "dateOfBirth"] as const;
type Field = (typeof FIELDS)[number];

type SignUpFormProps = { returnTo: string };

type Done = { signedIn: boolean };

/** How an already-registered email signs in, from the 409 code (SECURITY_AND_PRIVACY §2.5). */
type ExistingAccount = "password" | "google";

const EXISTING_ACCOUNT_BY_CODE: Record<string, ExistingAccount> = {
  EMAIL_ALREADY_REGISTERED: "password",
  EMAIL_REGISTERED_WITH_GOOGLE: "google",
};

// Sign-up with email (F-02). Not designed: built from the design system (P1-07). After registering, the
// form signs in with the same details (PO decision: new users go straight on, unverified). A taken
// email is reported on the email field with the way forward: "Sign in instead" (email carried
// over) or "Continue with Google" for accounts created with Google.
export function SignUpForm({ returnTo }: SignUpFormProps) {
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const [existingAccount, setExistingAccount] = useState<ExistingAccount | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  function handleSignInInstead() {
    rememberEmailForSignIn(emailRef.current?.value.trim() ?? "");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const parsed = registerSchema.safeParse({
      email: data.get("email"),
      password: data.get("password"),
      dateOfBirth: data.get("dateOfBirth"),
    });
    if (!parsed.success) {
      setFieldErrors(firstIssuePerField(parsed.error.issues, FIELDS));
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setExistingAccount(null);
    setPending(true);
    try {
      await registerAccount(parsed.data);
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setFieldErrors(error.fields);
        setFormError(Object.keys(error.fields).length > 0 ? null : error.message);
        setExistingAccount(EXISTING_ACCOUNT_BY_CODE[error.code] ?? null);
      }
      setPending(false);
      return;
    }

    const result = await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    }).catch(() => undefined);
    setDone({ signedIn: Boolean(result && !result.error) });
    setPending(false);
  }

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-title text-balance text-foreground">Check your email</h1>
        <p className="text-body text-foreground-secondary">
          We&apos;ve sent you a link. Open it to confirm your email so you can share with the
          community.
        </p>
        {done.signedIn ? (
          <>
            <Button size="lg" onClick={() => window.location.assign(returnTo)}>
              Continue
            </Button>
            <ResendVerificationButton />
          </>
        ) : (
          <Button asChild variant="outline" size="lg">
            <Link href="/sign-in">Go to sign in</Link>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-title text-balance text-foreground">Create your account</h1>
      <form method="post" noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
        {formError ? <ErrorBanner>{formError}</ErrorBanner> : null}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sign-up-email">Email</Label>
          <Input
            ref={emailRef}
            id="sign-up-email"
            name="email"
            type="email"
            autoComplete="email"
            aria-invalid={fieldErrors.email ? true : undefined}
            aria-describedby={fieldErrors.email ? "sign-up-email-error" : undefined}
          />
          <FieldError id="sign-up-email-error">{fieldErrors.email}</FieldError>
          {existingAccount === "password" ? (
            <Link
              href={`/sign-in?returnTo=${encodeURIComponent(returnTo)}`}
              onClick={handleSignInInstead}
              className="self-start text-body font-bold text-link hover:underline"
            >
              Sign in instead
            </Link>
          ) : null}
          {existingAccount === "google" ? (
            <GoogleSignInButton returnTo={returnTo} variant="outline" />
          ) : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sign-up-password">Password</Label>
          <Input
            id="sign-up-password"
            name="password"
            type="password"
            autoComplete="new-password"
            aria-invalid={fieldErrors.password ? true : undefined}
            aria-describedby="sign-up-password-hint sign-up-password-error"
          />
          <p id="sign-up-password-hint" className="text-meta text-foreground-secondary">
            At least {PASSWORD_MIN_LENGTH} characters.
          </p>
          <FieldError id="sign-up-password-error">{fieldErrors.password}</FieldError>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sign-up-dob">Date of birth</Label>
          <Input
            id="sign-up-dob"
            name="dateOfBirth"
            type="date"
            autoComplete="bday"
            aria-invalid={fieldErrors.dateOfBirth ? true : undefined}
            aria-describedby="sign-up-dob-hint sign-up-dob-error"
          />
          <p id="sign-up-dob-hint" className="text-meta text-foreground-secondary">
            dodoi is for adults. We only use this to check you&apos;re 18 or over, then discard it.
          </p>
          <FieldError id="sign-up-dob-error">{fieldErrors.dateOfBirth}</FieldError>
        </div>
        <Button type="submit" size="lg" disabled={pending}>
          Create account
        </Button>
      </form>
      <p className="text-center text-body text-foreground-secondary">
        Already have an account?{" "}
        <Link
          href={`/sign-in?returnTo=${encodeURIComponent(returnTo)}`}
          className="font-bold text-link hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
