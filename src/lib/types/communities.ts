import type { CommunityRoleName } from "@/lib/schemas/communities";
import type { Media } from "@/lib/types/media";
import type { CreatorSummary } from "@/lib/types/posts";
import type { SkillSummary } from "@/lib/types/skills";

// Community views returned by the API (API_SPECIFICATION §9.3, P3-01). No member lists and no
// member counts are public (PP-4); only the owner's manage view counts members.

export type { CommunityRoleName };

export type CommunityCard = {
  id: string;
  name: string;
  slug: string;
  description: string;
  /** Null when the skill has since been hidden. */
  skill: Pick<SkillSummary, "id" | "name" | "slug" | "accent"> | null;
  /** The viewer's role, or null when they have not joined. */
  myRole: CommunityRoleName | null;
};

export type CommunityDetail = CommunityCard & {
  rules: string[];
  /** A moderator removed the viewer; only the owner can let them back (COM-06). */
  isRemoved: boolean;
  /** A verified member who is not removed. */
  canJoin: boolean;
  /** Joined, not removed, and verified: may post and reply. */
  canPost: boolean;
};

export type CommunityPostView = {
  id: string;
  body: string;
  /** Null when the author's account is gone or their profile is hidden. */
  author: CreatorSummary | null;
  isOwn: boolean;
  photos: Media[];
  /** Hidden posts are only returned to their author, the owner and moderators. */
  isHidden: boolean;
  /** The author can still edit (15 minutes after posting). */
  canEdit: boolean;
  /** The author, the owner or a moderator. */
  canDelete: boolean;
  isEdited: boolean;
  createdAt: string;
};

export type CommunityThread = CommunityPostView & {
  replies: CommunityPostView[];
};

export type CommunityModerationEntry = {
  id: string;
  action: string;
  /** Null when their account is gone. */
  actor: { username: string; displayName: string } | null;
  targetType: string;
  createdAt: string;
};

export type CommunityMemberView = {
  userId: string;
  username: string;
  displayName: string;
  role: CommunityRoleName;
};

/** What the owner's and moderators' Manage sheet shows (COM-03, COM-04, COM-06). */
export type CommunityManageView = {
  memberCount: number;
  /** Current members (owner and moderators first, then newest), up to 100; only managers see it. */
  members: CommunityMemberView[];
  removed: CommunityMemberView[];
  log: CommunityModerationEntry[];
};
