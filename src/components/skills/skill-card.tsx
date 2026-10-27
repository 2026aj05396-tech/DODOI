import Link from "next/link";

import { PatternTile, type PatternAccent } from "@/components/ui/pattern-tile";
import type { SkillSummary } from "@/lib/types/skills";
import { cn } from "@/lib/utils/cn";

// Skill card (`1d`, UI_UX_GUIDELINES §4 SkillCard): bordered card, 40px accent swatch, the name and
// the editor's hint line (SRCH-08, DC-09). Opens the skill page.

export function SkillCard({
  skill,
  hint = skill.hint,
  className,
}: {
  skill: SkillSummary;
  hint?: string | null;
  className?: string;
}) {
  return (
    <Link
      href={`/s/${skill.slug}`}
      className={cn(
        "flex min-h-19 items-center gap-3 rounded-card border border-border bg-background p-3 transition-shadow hover:shadow-hover",
        className,
      )}
    >
      <PatternTile
        accent={skill.accent.toLowerCase() as PatternAccent}
        className="size-10 shrink-0 rounded-md"
      />
      <span className="flex min-w-0 flex-col">
        <span className="text-control-lg font-bold text-foreground">{skill.name}</span>
        {hint ? <span className="text-meta text-foreground-secondary">{hint}</span> : null}
      </span>
    </Link>
  );
}
