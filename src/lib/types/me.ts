import type { ExperienceLevel } from "@/lib/schemas/me";
import type { CollectionSummary } from "@/lib/types/collections";
import type { FollowCounts, FollowState } from "@/lib/types/follows";
import type { Media } from "@/lib/types/media";
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

export type ProfileVisibility = "PUBLIC" | "PRIVATE";

/** GET/PATCH /api/me/profile: the user's own profile. */
export type MyProfile = {
  username: string;
  displayName: string;
  bio: string | null;
  avatar: Media | null;
  visibility: ProfileVisibility;
  /** When the username may next change (OD-11: once per 30 days); null = now. */
  usernameChangeAvailableAt: string | null;
  /** "Pick your username" prompt on the own profile (DC-26). */
  showUsernamePrompt: boolean;
  /** Account settings: own email, and whether a password is set (Google-only accounts: no). */
  email: string;
  hasPassword: boolean;
};

export type ProfileSkill = { skill: SkillSummary; level: ExperienceLevel | null };

/**
 * GET /api/profiles/{username}. Others see a private profile (OD-10) as name, username and avatar
 * only; the owner always sees everything.
 */
export type ProfileView =
  | {
      isPrivate: true;
      username: string;
      displayName: string;
      avatarUrl: string | null;
    }
  | {
      isPrivate: false;
      isOwner: boolean;
      /** The owner's own setting (others only ever see public profiles in full). */
      visibility: ProfileVisibility;
      /** Hidden after a report (owner only; others get 404). */
      isHidden: boolean;
      username: string;
      displayName: string;
      bio: string | null;
      avatarUrl: string | null;
      skills: { interests: ProfileSkill[]; canHelp: ProfileSkill[]; wantsToLearn: ProfileSkill[] };
      publicCollections: CollectionSummary[];
      /** The Follow button: shown to others on public profiles only (FLW-01, FLW-02). */
      follow: FollowState;
      /** Followers and following, for the profile's owner alone (FLW-03). */
      followCounts: FollowCounts | null;
    };
