import Link from "next/link";

import { PatternTile } from "@/components/ui/pattern-tile";
import type { SkillSuggestion } from "@/lib/types/feed";
import { cn } from "@/lib/utils/cn";

// "New to you" card (FEED-14, `1c`/`2b`/`3c`): lavender stripes, overline, skill name, the
// admin-written pitch plus "3 beginner projects under an hour.", and "Try it →" to the skill page.

function quickLine(count: number): string | null {
  if (count === 0) return null;
  return `${count} beginner ${count === 1 ? "project" : "projects"} under an hour.`;
}

export function SkillSuggestionCard({
  suggestion,
  className,
}: {
  suggestion: SkillSuggestion;
  className?: string;
}) {
  const line = quickLine(suggestion.beginnerProjectCount);
  return (
    <section aria-labelledby={`suggestion-${suggestion.skill.id}`} className={className}>
      <PatternTile accent="new-to-you" className={cn("flex flex-col gap-2 p-4.5")}>
        <p className="text-overline text-plum uppercase">New to you</p>
        <h2 id={`suggestion-${suggestion.skill.id}`} className="text-greeting text-foreground">
          {suggestion.skill.name}
        </h2>
        <p className="text-body text-foreground">
          {suggestion.pitch}
          {line ? ` ${line}` : null}
        </p>
        <Link
          href={`/s/${suggestion.skill.slug}`}
          className="mt-1 self-start rounded-sm text-control font-bold text-foreground hover:underline"
        >
          Try it<span className="sr-only">: {suggestion.skill.name}</span>{" "}
          <span aria-hidden>→</span>
        </Link>
      </PatternTile>
    </section>
  );
}
