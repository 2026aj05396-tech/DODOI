"use client";

import { CalendarPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { PersonPickerDialog } from "@/components/people/person-picker-dialog";
import { Button, type ButtonProps } from "@/components/ui/button";

// "Schedule a session" (F-30 step 0): choose who to call first, then the usual proposal form opens
// for them. This is the entry point that doesn't need a profile, a conversation or a help reply.

export function ScheduleSessionButton({
  variant = "primary",
  size = "md",
  className,
}: Pick<ButtonProps, "variant" | "size" | "className">) {
  const router = useRouter();
  const [isPicking, setIsPicking] = useState(false);
  const [pendingUsername, setPendingUsername] = useState<string | null>(null);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={() => setIsPicking(true)}
      >
        <CalendarPlus aria-hidden className="size-4" />
        Schedule a session
      </Button>
      {isPicking ? (
        <PersonPickerDialog
          title="Schedule a session"
          description="Search for a maker, or pick one of the suggestions, to propose a call."
          emptyHint="Type a name or username. People you follow will show up here."
          noResultsTitle="No one found to schedule with"
          pendingUsername={pendingUsername}
          onPick={(person) => {
            setPendingUsername(person.username);
            router.push(`/community/sessions/new?with=${encodeURIComponent(person.username)}`);
          }}
          onClose={() => {
            setIsPicking(false);
            setPendingUsername(null);
          }}
        />
      ) : null}
    </>
  );
}
