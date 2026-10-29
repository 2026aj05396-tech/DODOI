"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Textarea } from "@/components/ui/input";
import { ApiRequestError } from "@/lib/api-client/request";
import { MAX_COMMENT_LENGTH } from "@/lib/schemas/comments";

// Field for a new comment, a reply or an edit (CMT-01, CMT-02). The text counter appears near the
// limit; the server checks the length again.

const COUNTER_FROM = MAX_COMMENT_LENGTH - 100;

export function CommentComposer({
  label,
  submitLabel,
  initialValue = "",
  placeholder,
  autoFocus = false,
  onSubmit,
  onCancel,
}: {
  label: string;
  submitLabel: string;
  initialValue?: string;
  placeholder?: string;
  autoFocus?: boolean;
  /** Resolves when saved; throws ApiRequestError to show its message under the field. */
  onSubmit: (body: string) => Promise<void>;
  onCancel?: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const body = value.trim();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!body || isSending) return;
    setIsSending(true);
    setError(null);
    try {
      await onSubmit(body);
      setValue("");
    } catch (caught) {
      setError(
        caught instanceof ApiRequestError
          ? (caught.fields.body ?? caught.message)
          : "We couldn't post that. Try again.",
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-2">
      <label className="sr-only" htmlFor={`composer-${label}`}>
        {label}
      </label>
      <Textarea
        id={`composer-${label}`}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder ?? label}
        maxLength={MAX_COMMENT_LENGTH}
        rows={2}
        autoFocus={autoFocus}
        className="min-h-16"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `composer-${label}-error` : undefined}
        onFocus={(event) => {
          // Put the caret after a pre-filled "@name ".
          const end = event.currentTarget.value.length;
          event.currentTarget.setSelectionRange(end, end);
        }}
      />
      {error ? <FieldError id={`composer-${label}-error`}>{error}</FieldError> : null}
      <div className="flex items-center justify-end gap-2.5">
        {value.length >= COUNTER_FROM ? (
          <span className="mr-auto text-meta text-muted-foreground">
            {value.length} / {MAX_COMMENT_LENGTH}
          </span>
        ) : null}
        {onCancel ? (
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" size="sm" disabled={!body || isSending}>
          {isSending ? "Sending…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
