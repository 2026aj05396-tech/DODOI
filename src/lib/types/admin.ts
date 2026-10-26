import type { ExperienceLevel } from "@/lib/schemas/me";
import type { Media } from "@/lib/types/media";
import type { Attribution, PostTypeName } from "@/lib/types/posts";

// Admin views (API_SPECIFICATION §8): everything the editor needs, including drafts.

export type PostStatusName = "DRAFT" | "PUBLISHED" | "UNPUBLISHED";

export type AdminAttribution = Attribution & { permissionRef: string | null };

export type AdminPost = {
  id: string;
  status: PostStatusName;
  type: PostTypeName;
  title: string;
  description: string | null;
  skillIds: string[];
  primarySkillId: string | null;
  media: Media[];
  difficulty: ExperienceLevel | null;
  estimatedMinutes: number | null;
  materials: { name: string; note: string | null }[];
  steps: { text: string; mediaId: string | null; media: Media | null }[];
  attribution: AdminAttribution | null;
  authorUsername: string | null;
  publishedAt: string | null;
  updatedAt: string;
};

export type AdminPostSummary = {
  id: string;
  status: PostStatusName;
  type: PostTypeName;
  title: string;
  sourceType: Attribution["sourceType"] | null;
  coverMedia: Media | null;
  publishedAt: string | null;
  updatedAt: string;
};

export type AdminTheme = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  coverMedia: Media | null;
  isPublished: boolean;
  position: number;
  postIds: string[];
};

export type AdminSkill = {
  id: string;
  name: string;
  slug: string;
  origin: "PREDEFINED" | "CUSTOM";
  status: "ACTIVE" | "HIDDEN";
  description: string | null;
  hint: string | null;
  pitch: string | null;
  coverMediaId: string | null;
  relatedSkillIds: string[];
};
