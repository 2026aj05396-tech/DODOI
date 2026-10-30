"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field-error";
import { showToast } from "@/components/ui/toast";
import { ApiRequestError } from "@/lib/api-client/request";
import { respondToSession } from "@/lib/api-client/sessions";
import type { SessionView } from "@/lib/types/sessions";
import { localInputToIso } from "@/lib/utils/session-time";

import { SessionTimeFields } from "./session-time-fields";

// "Suggest another time" (SES-02, F-30 step 2): the proposal is closed and a new one goes back to
// the person who proposed it, with the same length, note and link.

export function RescheduleDialog({
  session,
  onClose,
  onDone,
}: {
  session: SessionView;
  onClose: () => void;
  onDone: () => void;
}) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const name = session.other?.displayName ?? "them";

  async function send() {
    const startsAt = localInputToIso(date, time);
    setError(null);
    setFieldError(undefined);
    if (!startsAt) {
      setFieldError("Choose a date and time.");
      return;
    }
    setIsSending(true);
    try {
      await respondToSession(session.id, { action: "RESCHEDULE", startsAt });
      showToast({ message: `New time sent to ${name}` });
      onDone();
    } catch (caught) {
      setIsSending(false);
      if (caught instanceof ApiRequestError) {
        setFieldError(caught.fields.startsAt);
        setError(caught.fields.startsAt ? null : caught.message);
      } else {
        setError("We couldn't send that. Try again.");
      }
    }
  }

  return (
    <Dialog open onOpenChange={(open) => (open || isSending ? undefined : onClose())}>
      <DialogContent layout="sheet">
        <DialogTitle>Suggest another time</DialogTitle>
        <DialogDescription>
          {name} gets a new proposal with the same length and meeting link.
        </DialogDescription>
        <SessionTimeFields
          date={date}
          time={time}
          onDateChange={setDate}
          onTimeChange={setTime}
          error={fieldError}
        />
        <FieldError id="reschedule-error">{error}</FieldError>
        <div className="flex flex-col gap-2 md:flex-row-reverse">
          <Button onClick={() => void send()} disabled={isSending} className="md:flex-1">
            {isSending ? "Sending…" : "Send new time"}
          </Button>
          <Button variant="outline" onClick={onClose} disabled={isSending} className="md:flex-1">
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
