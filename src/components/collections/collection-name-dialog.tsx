"use client";

import { useId, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field-error";
import { Input, Label } from "@/components/ui/input";
import { ApiRequestError } from "@/lib/api-client/request";

// Name a collection: create (from "+ New collection") or rename (collection page). Errors from the
// server (name taken, 100-collection limit) show on the field.

type NameDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  submitLabel: string;
  initialName?: string;
  /** Resolves when saved; throws ApiRequestError to show a message. */
  onSubmit: (name: string) => Promise<void>;
};

export function CollectionNameDialog({ open, onOpenChange, ...form }: NameDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent layout="sheet">
        {/* The content unmounts when closed, so each opening starts from `initialName`. */}
        <NameForm {...form} close={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function NameForm({
  title,
  description,
  submitLabel,
  initialName = "",
  onSubmit,
  close,
}: Omit<NameDialogProps, "open" | "onOpenChange"> & { close: () => void }) {
  const id = useId();
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Give the collection a name.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await onSubmit(trimmed);
      close();
    } catch (caught) {
      setError(
        caught instanceof ApiRequestError
          ? (caught.fields.name ?? caught.message)
          : "We couldn't save that. Try again.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <DialogTitle>{title}</DialogTitle>
      {description ? <DialogDescription className="-mt-2">{description}</DialogDescription> : null}
      <form method="post" onSubmit={submit} className="flex flex-col gap-2" noValidate>
        <Label htmlFor={id}>Collection name</Label>
        <Input
          id={id}
          value={name}
          maxLength={80}
          autoFocus
          onChange={(event) => setName(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <FieldError id={`${id}-error`}>{error}</FieldError>
        <Button type="submit" disabled={isSaving} className="mt-2">
          {submitLabel}
        </Button>
      </form>
    </>
  );
}
