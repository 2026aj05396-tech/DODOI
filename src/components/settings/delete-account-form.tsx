"use client";

import Link from "next/link";
import { signIn, signOut } from "next-auth/react";
import { useId, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { FieldError } from "@/components/ui/field-error";
import { Input, Label } from "@/components/ui/input";
import { deleteAccount } from "@/lib/api-client/account";
import { ApiRequestError } from "@/lib/api-client/request";
import { formatLongDate } from "@/lib/utils/dates";

// Account deletion (F-14, P1-28). Accounts with a password confirm with it; Google-only accounts
// sign in with Google again first (fresh login prompt) and then have 5 minutes to confirm. On
// success the server has signed out every session; this device clears its cookie and shows when
// the account will be deleted.

const THIS_PAGE = "/settings/account/delete";
const DESTRUCTIVE = "bg-destructive text-inverse-foreground hover:bg-destructive/90";

type DeleteAccountFormProps = {
  hasPassword: boolean;
  /** Google-only accounts: whether this session signed in within the last 5 minutes. */
  isRecentSignIn: boolean;
  /** "What happens", shown above the confirmation until the deletion is scheduled. */
  explanation: ReactNode;
};

export function DeleteAccountForm({
  hasPassword,
  isRecentSignIn,
  explanation,
}: DeleteAccountFormProps) {
  const id = useId();
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [needsGoogle, setNeedsGoogle] = useState(!hasPassword && !isRecentSignIn);
  const [pending, setPending] = useState(false);
  const [scheduledFor, setScheduledFor] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setErrors({});
    try {
      const result = await deleteAccount(hasPassword ? { password } : {});
      await signOut({ redirect: false });
      setScheduledFor(result.deletionScheduledFor);
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === "REAUTHENTICATION_REQUIRED") {
        setNeedsGoogle(true);
      } else if (error instanceof ApiRequestError) {
        setErrors(Object.keys(error.fields).length > 0 ? error.fields : { form: error.message });
      } else {
        setErrors({ form: "We couldn't delete your account. Try again." });
      }
    } finally {
      setPending(false);
    }
  }

  async function confirmWithGoogle() {
    setPending(true);
    await signIn("google", { redirectTo: THIS_PAGE }, { prompt: "login" });
  }

  if (scheduledFor) {
    return (
      <div role="status" className="flex flex-col gap-4 rounded-card bg-card p-5">
        <h2 className="text-section text-foreground">Your account is scheduled for deletion</h2>
        <p className="text-body text-foreground">
          We&apos;ll delete it on {formatLongDate(scheduledFor)}. Changed your mind? Sign in before
          then to cancel.
        </p>
        <Button asChild variant="outline" className="self-start">
          <Link href="/">Back to dodoi</Link>
        </Button>
      </div>
    );
  }

  const confirmation = needsGoogle ? (
    <div className="flex flex-col gap-4">
      <p className="text-body text-foreground">
        To confirm it&apos;s you, sign in with Google again. You&apos;ll come back here to finish.
      </p>
      <Button
        variant="outline"
        onClick={confirmWithGoogle}
        disabled={pending}
        className="self-start"
      >
        Confirm with Google
      </Button>
    </div>
  ) : (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {errors.form ? <ErrorBanner>{errors.form}</ErrorBanner> : null}
      {hasPassword ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-password`}>Your password</Label>
          <Input
            id={`${id}-password`}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={errors.password ? `${id}-password-error` : undefined}
          />
          <FieldError id={`${id}-password-error`}>{errors.password}</FieldError>
        </div>
      ) : null}
      <Button type="submit" disabled={pending} className={`self-start ${DESTRUCTIVE}`}>
        {pending ? "Deleting…" : "Delete my account"}
      </Button>
    </form>
  );

  return (
    <div className="flex flex-col gap-6">
      {explanation}
      <section className="flex flex-col gap-3 border-t border-border pt-5">
        <h2 className="text-section text-foreground">Confirm</h2>
        {confirmation}
      </section>
    </div>
  );
}
