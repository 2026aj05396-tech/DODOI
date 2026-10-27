"use client";

import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input, Label } from "@/components/ui/input";
import { showToast } from "@/components/ui/toast";
import { changePassword } from "@/lib/api-client/account";
import { ApiRequestError } from "@/lib/api-client/request";

// Change password (P1-06 API; AUTH rules): current + new. Other devices are signed out; this one
// stays signed in.

export function ChangePasswordForm() {
  const id = useId();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setErrors({});
    try {
      await changePassword({ currentPassword: current, newPassword: next });
      setCurrent("");
      setNext("");
      showToast({ message: "Password changed. Other devices have been signed out." });
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setErrors(
          Object.keys(error.fields).length > 0
            ? error.fields
            : error.code === "INVALID_CURRENT_PASSWORD"
              ? { currentPassword: error.message }
              : { form: error.message },
        );
      } else {
        setErrors({ form: "We couldn't change your password. Try again." });
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-current`}>Current password</Label>
        <Input
          id={`${id}-current`}
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
          aria-invalid={errors.currentPassword ? true : undefined}
          aria-describedby={errors.currentPassword ? `${id}-current-error` : undefined}
        />
        <FieldError id={`${id}-current-error`}>{errors.currentPassword}</FieldError>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-new`}>New password</Label>
        <Input
          id={`${id}-new`}
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(event) => setNext(event.target.value)}
          aria-invalid={errors.newPassword ? true : undefined}
          aria-describedby={[`${id}-new-hint`, errors.newPassword ? `${id}-new-error` : null]
            .filter(Boolean)
            .join(" ")}
        />
        <p id={`${id}-new-hint`} className="text-meta text-foreground-secondary">
          At least 10 characters.
        </p>
        <FieldError id={`${id}-new-error`}>{errors.newPassword}</FieldError>
      </div>
      {errors.form ? (
        <p role="alert" className="text-body text-destructive">
          {errors.form}
        </p>
      ) : null}
      <Button type="submit" variant="outline" disabled={isSaving} className="self-start">
        {isSaving ? "Changing…" : "Change password"}
      </Button>
    </form>
  );
}
