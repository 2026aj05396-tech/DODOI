import { Users } from "lucide-react";
import Link from "next/link";

import type { HelpRequestCard } from "@/lib/types/help";
import { timeAgo } from "@/lib/utils/time-ago";

// "Help other makers" in the desktop right rail (DC-22, HLP-03; design `2b`): the newest open
// requests in skills the member can help with, or a way to get started when there are none.

export function HelpRailCard({
  requests,
  hasCanHelpSkills,
}: {
  requests: HelpRequestCard[];
  /** Whether the member listed any "can help with" skills. */
  hasCanHelpSkills: boolean;
}) {
  return (
    <section
      aria-labelledby="help-rail"
      className="flex flex-col gap-3 rounded-card border border-border bg-background p-4"
    >
      <h2 id="help-rail" className="flex items-center gap-2 text-section text-foreground">
        <Users aria-hidden className="size-5 text-foreground-secondary" />
        Help other makers
      </h2>
      {requests.length > 0 ? (
        <ul className="flex flex-col gap-2.5">
          {requests.map((request) => (
            <li key={request.id}>
              <Link
                href={`/community/help/${request.id}`}
                className="flex flex-col gap-0.5 rounded-sm hover:underline"
              >
                <span className="text-control font-bold text-foreground">{request.title}</span>
                <span className="text-meta text-foreground-secondary">
                  {request.skill?.name ? `${request.skill.name} · ` : ""}
                  {timeAgo(request.createdAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-body text-foreground-secondary">
          {hasCanHelpSkills
            ? "No open questions in your skills right now."
            : "Answer questions from people learning the skills you know."}
        </p>
      )}
      <Link
        href={hasCanHelpSkills || requests.length > 0 ? "/community" : "/settings/skills"}
        className="self-start rounded-sm text-control font-bold text-link hover:underline"
      >
        {hasCanHelpSkills || requests.length > 0
          ? "See all requests"
          : "Choose skills you can help with"}
      </Link>
    </section>
  );
}
