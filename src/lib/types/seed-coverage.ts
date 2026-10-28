import type { PostTypeName } from "@/lib/types/posts";

// Seed content against the OD-31 launch minimums (P1-19): the admin Coverage page and the
// importer's report.

export type SkillCoverage = {
  slug: string;
  name: string;
  /** A launch-focus skill (higher minimum, tutorials required). */
  focus: boolean;
  posts: number;
  tutorials: number;
  minPosts: number;
  /** 0 for skills outside the launch focus. */
  minTutorials: number;
  met: boolean;
};

export type TypeCoverage = { type: PostTypeName; posts: number; min: number; met: boolean };

export type ThemeCoverage = {
  slug: string;
  title: string;
  posts: number;
  min: number;
  met: boolean;
};

export type SeedCoverage = {
  /** Launch-focus skills first, then the rest; each group by name. */
  skills: SkillCoverage[];
  types: TypeCoverage[];
  /** `null` when themes aren't known (seed files don't assign themes). */
  themes: ThemeCoverage[] | null;
  /** Launch-focus slugs that aren't an active predefined skill (renamed, hidden or missing). */
  missingFocusSkills: string[];
  /** Rows below their minimum, plus missing focus skills. 0 = OD-31 met. */
  gaps: number;
};
