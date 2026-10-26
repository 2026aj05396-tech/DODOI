import type { ExperienceLevel } from "@/lib/schemas/me";
import type { Media } from "@/lib/types/media";
import type { SkillSummary } from "@/lib/types/skills";

// Post and theme views returned by the API (API_SPECIFICATION §2, §5).

export type PostTypeName =
  "FIRST_ATTEMPT" | "TUTORIAL" | "WORK_IN_PROGRESS" | "JOURNAL" | "FINISHED" | "TIP";

export type Attribution = {
  sourceType: "TEAM_ORIGINAL" | "INVITED_CREATOR" | "STOCK_LICENSED" | "CREATIVE_COMMONS";
  license: string;
  attributionText: string;
  originalAuthor: string | null;
  originalUrl: string | null;
};

export type CreatorSummary = { username: string; displayName: string; avatarUrl: string | null };

export type PostCard = {
  id: string;
  type: PostTypeName;
  title: string;
  /** Shown in the type label, e.g. "Tutorial · 45 min". */
  estimatedMinutes: number | null;
  coverMedia: Media;
  mediaCount: number;
  skills: SkillSummary[];
  primarySkillId: string;
  /** Null for team, stock and Creative Commons posts ("via dodoi editors", DC-27). */
  creator: CreatorSummary | null;
  attribution: Attribution | null;
  /** Always false for signed-out visitors (OD-29). */
  isSaved: boolean;
};

export type PostDetail = PostCard & {
  description: string | null;
  media: Media[];
  difficulty: ExperienceLevel | null;
  materials: { id: string; name: string; note: string | null }[];
  steps: { position: number; text: string; media: Media | null }[];
  publishedAt: string;
};

export type ThemeSummary = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  coverMedia: Media | null;
};

/** A signed-in user's ticks on a post (POST-11/12); private to them. */
export type PostProgress = {
  checkedMaterialIds: string[];
  completedStepPositions: number[];
  /** Null until the user ticks something. */
  updatedAt: string | null;
};
