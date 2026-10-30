"use client";

import { useId } from "react";

import { FieldError } from "@/components/ui/field-error";
import { Input, Label } from "@/components/ui/input";
import { formatSessionTime, localInputToIso, todayInput } from "@/lib/utils/session-time";

// Date and time for a session (SES-03). They are read in the viewer's time zone; when that is not
// IST, the matching IST time is shown underneath so both people know what was meant.

export function SessionTimeFields({
  date,
  time,
  onDateChange,
  onTimeChange,
  error,
}: {
  date: string;
  time: string;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
  error?: string;
}) {
  const id = useId();
  const iso = localInputToIso(date, time);
  const preview = iso ? formatSessionTime(iso) : null;
  return (
    <div className="flex flex-col gap-2">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-date`}>Date</Label>
          <Input
            id={`${id}-date`}
            type="date"
            min={todayInput()}
            value={date}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${id}-error` : `${id}-preview`}
            onChange={(event) => onDateChange(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-time`}>Time</Label>
          <Input
            id={`${id}-time`}
            type="time"
            value={time}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${id}-error` : `${id}-preview`}
            onChange={(event) => onTimeChange(event.target.value)}
          />
        </div>
      </div>
      <p id={`${id}-preview`} className="text-meta text-foreground-secondary">
        {preview
          ? preview.ist
            ? `${preview.local} for you · ${preview.ist}`
            : preview.local
          : "Times are in your time zone."}
      </p>
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </div>
  );
}
