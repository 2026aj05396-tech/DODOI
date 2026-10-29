import type { Media } from "@/lib/types/media";
import type { CreatorSummary } from "@/lib/types/posts";
import type { SkillSummary } from "@/lib/types/skills";

// Creative journal views (API_SPECIFICATION §9.1, P2-03).

export type ProjectStatusName = "IN_PROGRESS" | "COMPLETED";
export type ProjectVisibilityName = "PRIVATE" | "PUBLIC";

export type ProjectSummary = {
  id: string;
  title: string;
  status: ProjectStatusName;
  visibility: ProjectVisibilityName;
  skill: SkillSummary | null;
  /** The newest entry's first photo, if any. */
  coverMedia: Media | null;
  entryCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ProjectEntry = {
  id: string;
  /** 1 for the first entry, counting up (design `1g`: "Entry 3 · today"). */
  number: number;
  title: string | null;
  body: string | null;
  media: Media[];
  createdAt: string;
};

export type Project = ProjectSummary & {
  isOwner: boolean;
  owner: CreatorSummary;
  /** The tutorial it was started from ("Start as my project"). */
  sourcePost: { id: string; title: string } | null;
  materials: { id: string; name: string; note: string | null; checked: boolean }[];
  /** Newest first. */
  entries: ProjectEntry[];
  completedAt: string | null;
};
