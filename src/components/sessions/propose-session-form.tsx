"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { showToast } from "@/components/ui/toast";
import { ApiRequestError } from "@/lib/api-client/request";
import { proposeSession } from "@/lib/api-client/sessions";
import { SESSION_DURATIONS, SESSION_LINK_MAX, SESSION_NOTE_MAX } from "@/lib/schemas/sessions";
import { localInputToIso } from "@/lib/utils/session-time";

import { SessionTimeFields } from "./session-time-fields";

// Propose a session (SES-01, F-30 step 1; not designed, built from the system): a date and time, a
// length, an optional note and the meeting link. dodoi never hosts the call: the link is the
// member's own Google Meet, Zoom or similar.

export function ProposeSessionForm({
  invitee,
  helpRequestId,
  isVerified,
}: {
  invitee: { username: string; displayName: string };
  helpRequestId?: string;
  isVerified: boolean;
}) {
  const id = useId();
  const router = useRouter();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState<number>(30);
  const [note, setNote] = useState("");
  const [link, setLink] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const startsAt = localInputToIso(date, time);
    const next: Record<string, string> = {};
    if (!startsAt) next.startsAt = "Choose a date and time.";
    if (!link.trim()) next.meetingUrl = "Add the meeting link.";
    setErrors(next);
    setFormError(null);
    if (!startsAt || Object.keys(next).length > 0) return;
    setIsSending(true);
    try {
      await proposeSession({
        inviteeUsername: invitee.username,
        startsAt,
        durationMin: duration as (typeof SESSION_DURATIONS)[number],
        meetingUrl: link.trim(),
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(helpRequestId ? { helpRequestId } : {}),
      });
      showToast({ message: `Sent to ${invitee.displayName}` });
      router.push("/community/sessions");
    } catch (caught) {
      setIsSending(false);
      if (caught instanceof ApiRequestError) {
        setErrors(caught.fields);
        setFormError(caught.message);
      } else {
        setFormError("We couldn't send that. Try again.");
      }
    }
  }

  return (
    <form method="post" onSubmit={submit} noValidate className="flex flex-col gap-5">
      {!isVerified ? (
        <p role="status" className="rounded-md bg-butter p-3.5 text-body text-foreground">
          Verify your email to propose a session. You can fill it in now.
        </p>
      ) : null}
      <SessionTimeFields
        date={date}
        time={time}
        onDateChange={setDate}
        onTimeChange={setTime}
        error={errors.startsAt}
      />
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-length`}>Length</Label>
        <Select
          id={`${id}-length`}
          value={duration}
          onChange={(event) => setDuration(Number(event.target.value))}
        >
          {SESSION_DURATIONS.map((minutes) => (
            <option key={minutes} value={minutes}>
              {minutes} minutes
            </option>
          ))}
        </Select>
        <FieldError id={`${id}-length-error`}>{errors.durationMin}</FieldError>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-link`}>Meeting link</Label>
        <Input
          id={`${id}-link`}
          type="url"
          inputMode="url"
          autoComplete="off"
          placeholder="https://meet.google.com/…"
          value={link}
          maxLength={SESSION_LINK_MAX}
          aria-invalid={Boolean(errors.meetingUrl)}
          aria-describedby={`${id}-link-hint${errors.meetingUrl ? ` ${id}-link-error` : ""}`}
          onChange={(event) => setLink(event.target.value)}
        />
        <p id={`${id}-link-hint`} className="text-meta text-foreground-secondary">
          Use your own Google Meet, Zoom or similar link. dodoi doesn&apos;t host or record the
          call. Only {invitee.displayName} sees it, and only once they accept.
        </p>
        <FieldError id={`${id}-link-error`}>{errors.meetingUrl}</FieldError>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-note`}>Note (optional)</Label>
        <Textarea
          id={`${id}-note`}
          rows={3}
          value={note}
          maxLength={SESSION_NOTE_MAX}
          aria-describedby={`${id}-note-count`}
          onChange={(event) => setNote(event.target.value)}
        />
        <p id={`${id}-note-count`} className="text-meta text-foreground-secondary">
          {note.length} / {SESSION_NOTE_MAX}
        </p>
        <FieldError id={`${id}-note-error`}>{errors.note}</FieldError>
      </div>
      <FieldError id={`${id}-form-error`}>{formError}</FieldError>
      <div className="flex flex-col gap-2 md:flex-row-reverse">
        <Button type="submit" disabled={isSending || !isVerified} className="md:min-w-40">
          {isSending ? "Sending…" : "Send proposal"}
        </Button>
      </div>
    </form>
  );
}
