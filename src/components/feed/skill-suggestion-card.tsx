import { ComingSoonTrigger } from "@/components/layout/coming-soon-trigger";
import { PatternTile } from "@/components/ui/pattern-tile";
import type { SkillSuggestion } from "@/lib/types/feed";
import { cn } from "@/lib/utils/cn";

// "New to you" card (FEED-14, `1c`/`2b`/`3c`): lavender stripes, overline, skill name, the
// admin-written pitch plus "3 beginner projects under an hour.", and "Try it →". The skill page
// arrives with P1-26, so "Try it" is coming soon until then.

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
        <ComingSoonTrigger
          label={`Try ${suggestion.skill.name}`}
          className="mt-1 self-start rounded-sm text-control font-bold text-foreground"
        >
          <span aria-hidden>Try it →</span>
        </ComingSoonTrigger>
      </PatternTile>
    </section>
  );
}
