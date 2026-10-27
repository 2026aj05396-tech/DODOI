import Link from "next/link";

import type { SkillSummary } from "@/lib/types/skills";
import { cn } from "@/lib/utils/cn";

/** A skill as a lavender chip that opens its skill page (SRCH-06; post chips, related skills). */
export function SkillChipLink({ skill, className }: { skill: SkillSummary; className?: string }) {
  return (
    <Link
      href={`/s/${skill.slug}`}
      className={cn(
        "inline-flex items-center rounded-full bg-lavender px-3 py-1 text-meta font-bold text-plum hover:underline",
        className,
      )}
    >
      {skill.name}
    </Link>
  );
}
