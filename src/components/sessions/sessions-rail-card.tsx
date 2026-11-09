import { Video } from "lucide-react";
import Link from "next/link";

import { ScheduleSessionButton } from "./schedule-session-button";

// "Live sessions" in the desktop right rail (design `2b`): a 30-minute call with a maker, now that
// sessions are live (P3-04). Opens the person picker; "Your sessions" goes to the list.

export function SessionsRailCard() {
  return (
    <section
      aria-labelledby="sessions-rail"
      className="flex flex-col gap-3 rounded-card border border-border bg-background p-4"
    >
      <h2 id="sessions-rail" className="flex items-center gap-2 text-section text-foreground">
        <Video aria-hidden className="size-5 text-foreground-secondary" />
        Live sessions
      </h2>
      <p className="text-body text-foreground-secondary">
        Book a short call with a maker on your own meeting link.
      </p>
      <ScheduleSessionButton size="sm" className="self-start" />
      <Link
        href="/community/sessions"
        className="self-start rounded-sm text-control font-bold text-link hover:underline"
      >
        Your sessions
      </Link>
    </section>
  );
}
