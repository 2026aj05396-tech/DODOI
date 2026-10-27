import type { Paginated } from "@/lib/types/api";
import type { CreatorSummary, PostCard, ThemeSummary } from "@/lib/types/posts";
import type { SkillSummary } from "@/lib/types/skills";

// Search and Explore responses (API_SPECIFICATION §5).

/** `type=all`: up to 8 of each, no paging. */
export type SearchAll = { posts: PostCard[]; skills: SkillSummary[]; creators: CreatorSummary[] };

export type SearchResults =
  SearchAll | Paginated<PostCard> | Paginated<SkillSummary> | Paginated<CreatorSummary>;

export type SkillToTry = { skill: SkillSummary; hint: string };

export type ExploreData = {
  popularSkills: SkillSummary[];
  newSkills: SkillSummary[];
  /** Skills outside the user's interests with an editor's hint (SRCH-08). */
  skillsToTry: SkillToTry[];
  themes: ThemeSummary[];
  beginnerFriendly: PostCard[];
};
