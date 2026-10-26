import type { ExperienceLevel } from "@/lib/schemas/me";
import type { PostTypeName } from "@/lib/types/posts";

// Labels shown on post cards and the post page (PRODUCT_REQUIREMENTS §5.4).

const TYPE_LABELS: Record<PostTypeName, string> = {
  FIRST_ATTEMPT: "First attempt",
  TUTORIAL: "Tutorial",
  WORK_IN_PROGRESS: "Work in progress",
  JOURNAL: "Journal",
  FINISHED: "Finished",
  TIP: "Tip",
};

const LEVEL_LABELS: Record<ExperienceLevel, string> = {
  CURIOUS: "Curious",
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  EXPERIENCED: "Experienced",
};

/** "45 min", "1 h", "1 h 30 min". */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** Card label: the post type, and for tutorials the time too ("Tutorial · 20 min"). */
export function postTypeLabel(type: PostTypeName, estimatedMinutes: number | null): string {
  const label = TYPE_LABELS[type];
  return type === "TUTORIAL" && estimatedMinutes
    ? `${label} · ${formatMinutes(estimatedMinutes)}`
    : label;
}

export function levelLabel(level: ExperienceLevel): string {
  return LEVEL_LABELS[level];
}
