import { CalendarPlus } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

// "Propose a session" (F-30 step 1): opens the proposal form for that person, from their profile,
// a conversation or a reply to a help request (which is then linked to the session).

export function ProposeSessionLink({
  username,
  helpRequestId,
  size = "sm",
}: {
  username: string;
  helpRequestId?: string;
  size?: "sm" | "md";
}) {
  const params = new URLSearchParams({ with: username });
  if (helpRequestId) params.set("request", helpRequestId);
  return (
    <Button asChild variant="outline" size={size}>
      <Link
        href={`/community/sessions/new?${params}`}
        aria-label={`Propose a session to @${username}`}
      >
        <CalendarPlus aria-hidden className="size-4" />
        Propose a session
      </Link>
    </Button>
  );
}
