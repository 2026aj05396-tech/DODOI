"use client";

import { Flag } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field-error";
import { Label } from "@/components/ui/input";
import { sendReport } from "@/lib/api-client/reports";
import { ApiRequestError } from "@/lib/api-client/request";
import type { ReportReason } from "@/lib/schemas/reports";
import { cn } from "@/lib/utils/cn";

// Report a custom skill, profile, post or comment (RPT-01…05, MOD-01; not designed, built from the
// system): a reason, an optional note, then a neutral thank-you. The reported person is never told
// who reported. `ReportDialog` opens from a menu item; `ReportButton` is the plain trigger.

const REASONS: { value: ReportReason; label: string }[] = [
  { value: "OFFENSIVE", label: "Offensive or hateful" },
  { value: "SPAM", label: "Spam or advertising" },
  { value: "IMPERSONATION", label: "Pretending to be someone else" },
  { value: "NOT_MY_WORK", label: "Not my work" },
  { value: "OTHER", label: "Something else" },
];

const NOTE_MAX = 500;

export type ReportTarget = {
  targetType:
    "SKILL" | "PROFILE" | "POST" | "COMMENT" | "AI_MESSAGE" | "HELP_REQUEST" | "HELP_RESPONSE";
  /** Skill id, username for a profile, post id or comment id. */
  targetId: string;
  /** "this profile", "this skill", "this comment", "this answer" (used in the title). */
  targetLabel: string;
};

/** The report sheet; mount it while it is open and call `onClose` when it should go. */
export function ReportDialog({
  targetType,
  targetId,
  targetLabel,
  onClose,
}: ReportTarget & { onClose: () => void }) {
  const id = useId();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!reason) {
      setError("Choose a reason.");
      return;
    }
    setIsSending(true);
    setError(null);
    try {
      await sendReport({ targetType, targetId, reason, note: note.trim() || undefined });
      setIsSent(true);
    } catch (caught) {
      setError(
        caught instanceof ApiRequestError ? caught.message : "We couldn't send that. Try again.",
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent layout="sheet">
        {isSent ? (
          <>
            <DialogTitle>Thanks for letting us know</DialogTitle>
            <DialogDescription>
              Our team will take a look. We won&apos;t tell anyone who sent the report.
            </DialogDescription>
            <Button onClick={onClose}>Done</Button>
          </>
        ) : (
          <>
            <DialogTitle>Report {targetLabel}</DialogTitle>
            <DialogDescription>
              Reports are private. We&apos;ll review it and act if it breaks our guidelines.
            </DialogDescription>
            <form method="post" onSubmit={submit} noValidate className="flex flex-col gap-4">
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-control-sm font-bold text-foreground">
                  What&apos;s wrong?
                </legend>
                {REASONS.map((option) => (
                  <label
                    key={option.value}
                    className={cn(
                      "flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3.5",
                      reason === option.value ? "border-foreground" : "border-border",
                    )}
                  >
                    <input
                      type="radio"
                      name={`${id}-reason`}
                      value={option.value}
                      checked={reason === option.value}
                      onChange={() => setReason(option.value)}
                      className="size-4.5 shrink-0 accent-[var(--color-foreground)]"
                    />
                    <span className="text-body text-foreground">{option.label}</span>
                  </label>
                ))}
              </fieldset>
              <div className="flex flex-col gap-2">
                <Label htmlFor={`${id}-note`}>Anything else? (optional)</Label>
                <textarea
                  id={`${id}-note`}
                  value={note}
                  maxLength={NOTE_MAX}
                  rows={3}
                  onChange={(event) => setNote(event.target.value)}
                  aria-describedby={`${id}-count`}
                  className="w-full rounded-md border-control border-input bg-background px-3.5 py-3 text-control-lg text-foreground"
                />
                <p id={`${id}-count`} className="text-meta text-foreground-secondary">
                  {note.length} / {NOTE_MAX}
                </p>
              </div>
              <FieldError id={`${id}-error`}>{error}</FieldError>
              <Button type="submit" disabled={isSending}>
                {isSending ? "Sending…" : "Send report"}
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ReportButton({ className, ...target }: ReportTarget & { className?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <Button
        variant="text"
        onClick={() => setIsOpen(true)}
        className={cn("gap-1.5 text-foreground-secondary", className)}
      >
        <Flag aria-hidden className="size-4" />
        Report
      </Button>
      {isOpen ? <ReportDialog {...target} onClose={() => setIsOpen(false)} /> : null}
    </>
  );
}
