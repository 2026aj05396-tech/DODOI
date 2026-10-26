import type { ExperienceLevel } from "@/lib/schemas/me";
import type { SkillSummary } from "@/lib/types/skills";

// Responses for the signed-in user's own data (API_SPECIFICATION §4).

export type UserSkillItem = {
  skill: SkillSummary;
  isInterest: boolean;
  canHelp: boolean;
  wantsToLearn: boolean;
  /** Null = not specified. */
  level: ExperienceLevel | null;
};

export type UserSkills = { items: UserSkillItem[] };

export type OnboardingState = {
  /** Step to resume at: 1 interests, 2 familiarity, 3 can-help-with. */
  step: number;
  completed: boolean;
  /** Active skills marked as interests (onboarding needs at least 3). */
  interestCount: number;
};
