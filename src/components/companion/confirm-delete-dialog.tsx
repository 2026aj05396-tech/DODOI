"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

/** Asks before chats are deleted for good (one chat in the list, or all of them in Settings). */
export function ConfirmDeleteDialog({
  title,
  description,
  confirmLabel,
  isBusy,
  onConfirm,
  onCancel,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  isBusy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => (open || isBusy ? undefined : onCancel())}>
      <DialogContent layout="sheet">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        <div className="flex flex-col gap-2 md:flex-row-reverse">
          <Button variant="destructive" onClick={onConfirm} disabled={isBusy} className="md:flex-1">
            {isBusy ? "Deleting…" : confirmLabel}
          </Button>
          <Button variant="outline" onClick={onCancel} disabled={isBusy} className="md:flex-1">
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
