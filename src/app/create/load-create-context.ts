import "server-only";

import { redirect } from "next/navigation";

import type { CreatorSummary, OwnPost, OwnPostSummary } from "@/lib/types/posts";
import type { SkillSummary } from "@/lib/types/skills";
import { getActor } from "@/server/auth";
import { avatarUrl, getOwnPost, listOwnPosts } from "@/server/modules/content";
import { getActiveSkillSummaries } from "@/server/modules/skills";
import { getCreatorProfiles, getMySkills } from "@/server/modules/users";

export type CreateContext = {
  post: OwnPost | null;
  /** The maker's interests first (suggestions), then the post's own skills. */
  skills: SkillSummary[];
  creator: CreatorSummary | null;
  drafts: OwnPostSummary[];
  canAddOwnSkill: boolean;
};

/** What the Create post flow (F-17) needs; signs the visitor in first. */
export async function loadCreateContext(path: string, postId?: string): Promise<CreateContext> {
  const actor = await getActor();
  if (!actor) redirect(`/sign-in?returnTo=${encodeURIComponent(path)}`);
  if (!actor.isAgeConfirmed) redirect(`/confirm-age?returnTo=${encodeURIComponent(path)}`);

  const [post, mySkills, creators, drafts] = await Promise.all([
    postId ? getOwnPost(actor, postId) : null,
    getMySkills(actor),
    getCreatorProfiles([actor.id]),
    postId ? null : listOwnPosts(actor, { status: "DRAFT", limit: 12 }),
  ]);
  const interests = mySkills.items.filter((item) => item.isInterest).map((item) => item.skill);
  const known = new Set(interests.map((skill) => skill.id));
  const extra = await getActiveSkillSummaries(
    (post?.skillIds ?? []).filter((id) => !known.has(id)),
  );
  const profile = creators.get(actor.id);

  return {
    post,
    skills: [...interests, ...extra.values()],
    creator: profile
      ? {
          username: profile.username,
          displayName: profile.displayName,
          avatarUrl: profile.avatarPublicId ? avatarUrl(profile.avatarPublicId) : null,
        }
      : null,
    drafts: drafts?.items ?? [],
    canAddOwnSkill: actor.isEmailVerified,
  };
}
