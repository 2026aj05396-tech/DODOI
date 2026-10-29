import { ChevronRight, EyeOff, Lock, LogOut, Settings } from "lucide-react";
import Link from "next/link";

import { LogOutDialog } from "@/components/auth/log-out-dialog";
import { CollectionTile } from "@/components/collections/collection-tile";
import { ReportButton } from "@/components/reports/report-button";
import { Button } from "@/components/ui/button";
import type { Paginated } from "@/lib/types/api";
import type { FollowCounts, FollowState } from "@/lib/types/follows";
import type { ProjectSummary } from "@/lib/types/journal";
import type { ProfileSkill, ProfileView as ProfileViewData } from "@/lib/types/me";
import type { OwnPostSummary, PostCard } from "@/lib/types/posts";
import { cn } from "@/lib/utils/cn";
import { levelLabel } from "@/lib/utils/post-labels";

import { Avatar } from "./avatar";
import { FollowButton } from "./follow-button";
import { ProfileTabs } from "./profile-tabs";
import { UsernamePrompt } from "./username-prompt";

// Public profile (`/u/{username}`, PRF-05…08; design `1i`, tablet/desktop built from the system).
// Skill groups follow DC-08: Can help with (coral), Want to learn (butter), Interests (outline).
// Tabs: Projects (P2-03), Collections, Posts (P2-02).

const GROUPS = [
  { key: "canHelp", label: "Can help with", chip: "bg-primary text-foreground font-bold" },
  { key: "wantsToLearn", label: "Want to learn", chip: "bg-butter text-foreground" },
  { key: "interests", label: "Interests", chip: "border border-border-strong text-foreground" },
] as const;

function SkillGroup({
  label,
  chip,
  skills,
}: {
  label: string;
  chip: string;
  skills: ProfileSkill[];
}) {
  if (skills.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-overline text-foreground-secondary uppercase">{label}</h3>
      <ul className="flex flex-wrap gap-2">
        {skills.map(({ skill, level }) => (
          <li key={skill.id}>
            <Link
              href={`/s/${skill.slug}`}
              className={cn(
                "inline-block rounded-full px-3 py-1.5 text-chip hover:underline",
                chip,
              )}
            >
              {skill.name}
              {level ? (
                <span className="font-normal text-foreground-secondary">
                  {" "}
                  · {levelLabel(level)}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Header({
  profile,
  isOwner,
  follow,
  followCounts,
}: {
  profile: { displayName: string; username: string; avatarUrl: string | null };
  isOwner: boolean;
  /** Follow button state for someone else's public profile (FLW-01, FLW-02). */
  follow?: FollowState;
  /** Owner only (FLW-03). */
  followCounts?: FollowCounts | null;
}) {
  return (
    <header className="flex flex-col gap-4">
      <div className="flex items-center gap-4 md:gap-6">
        <Avatar url={profile.avatarUrl} className="size-22 shrink-0 md:size-28" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="text-greeting wrap-break-word text-foreground md:text-greeting-web">
            {profile.displayName}
          </h1>
          <p className="text-body text-foreground-secondary">@{profile.username}</p>
          {followCounts ? (
            <p className="flex gap-3 text-body text-foreground-secondary">
              <Link href="/profile/followers" className="hover:underline">
                <span className="font-bold text-foreground">{followCounts.followers}</span>{" "}
                {followCounts.followers === 1 ? "follower" : "followers"}
              </Link>
              <Link href="/profile/following" className="hover:underline">
                <span className="font-bold text-foreground">{followCounts.following}</span>{" "}
                following
              </Link>
            </p>
          ) : null}
        </div>
      </div>
      {!isOwner ? (
        <div className="flex flex-wrap items-center gap-3">
          {follow?.canFollow ? (
            <FollowButton
              username={profile.username}
              displayName={profile.displayName}
              initialFollowing={follow.isFollowing}
              isSignedIn
              returnTo={`/u/${profile.username}`}
            />
          ) : null}
          <ReportButton
            targetType="PROFILE"
            targetId={profile.username}
            targetLabel="this profile"
          />
        </div>
      ) : null}
      {isOwner ? (
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/settings/profile">Edit profile</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/settings">
              <Settings aria-hidden className="size-4" />
              Settings
            </Link>
          </Button>
        </div>
      ) : null}
    </header>
  );
}

/**
 * Settings and Log out at the end of your own profile (`1i`). From 1280px the sidebar has Log out,
 * and the header's Settings button covers the rest.
 */
function AccountActions() {
  const row = "flex min-h-13 w-full items-center gap-3 px-4 text-left text-body";
  return (
    <nav
      aria-label="Account"
      className="flex flex-col rounded-card border border-border bg-background xl:hidden"
    >
      <Link
        href="/settings"
        className={cn(
          row,
          "rounded-t-card border-b border-border-faint text-foreground hover:bg-muted",
        )}
      >
        <Settings aria-hidden className="size-5" strokeWidth={1.7} />
        Settings and privacy
        <ChevronRight aria-hidden className="ml-auto size-4.5 text-muted-foreground" />
      </Link>
      <LogOutDialog>
        <button
          type="button"
          className={cn(
            row,
            "rounded-b-card font-bold text-destructive hover:bg-destructive-surface",
          )}
        >
          <LogOut aria-hidden className="size-5" strokeWidth={1.8} />
          Log out
        </button>
      </LogOutDialog>
    </nav>
  );
}

export function ProfileView({
  profile,
  showUsernamePrompt,
  supportEmail,
  posts,
  drafts,
  projects,
}: {
  /** Projects tab (P2-03). */
  projects: ProjectSummary[];
  profile: ProfileViewData;
  showUsernamePrompt: boolean;
  /** First page of the Posts tab (P2-02). */
  posts: Paginated<PostCard>;
  /** The owner's drafts (empty for everyone else). */
  drafts: OwnPostSummary[];
  /** For the hidden-profile notice; without it the notice names the dodoi team. */
  supportEmail: string | null;
}) {
  if (profile.isPrivate) {
    return (
      <div className="flex flex-col gap-6">
        <Header profile={profile} isOwner={false} />
        <p className="flex items-center gap-2 rounded-card bg-field p-4 text-body text-foreground">
          <Lock aria-hidden className="size-4.5 shrink-0" />
          This profile is private.
        </p>
      </div>
    );
  }

  const hasSkills = GROUPS.some((group) => profile.skills[group.key].length > 0);
  return (
    <div className="flex flex-col gap-6">
      <Header
        profile={profile}
        isOwner={profile.isOwner}
        follow={profile.follow}
        followCounts={profile.followCounts}
      />
      {profile.isOwner && profile.isHidden ? (
        <p
          role="status"
          className="flex items-start gap-2.5 rounded-card bg-destructive-surface p-4 text-body text-foreground"
        >
          <EyeOff aria-hidden className="mt-0.5 size-4.5 shrink-0" />
          <span>
            Your profile is hidden from other makers after a report. If you think this is a mistake,
            {supportEmail ? (
              <>
                {" "}
                contact us at{" "}
                <a href={`mailto:${supportEmail}`} className="font-bold text-link hover:underline">
                  {supportEmail}
                </a>
                .
              </>
            ) : (
              " contact the dodoi team."
            )}
          </span>
        </p>
      ) : null}
      {profile.isOwner && showUsernamePrompt ? (
        <UsernamePrompt username={profile.username} />
      ) : null}
      {profile.isOwner && profile.visibility === "PRIVATE" ? (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-card bg-field p-4 text-body text-foreground">
          <Lock aria-hidden className="size-4.5 shrink-0" />
          Your profile is private. Others see only your name, username and photo.
          <Link href="/settings/privacy" className="font-bold text-link hover:underline">
            Change
          </Link>
        </p>
      ) : null}
      {profile.bio ? (
        <p className="text-body-lg whitespace-pre-line text-foreground md:text-body-lg-web">
          {profile.bio}
        </p>
      ) : null}

      {hasSkills ? (
        <section aria-label="Skills" className="flex flex-col gap-4 border-t border-border pt-5">
          {GROUPS.map((group) => (
            <SkillGroup
              key={group.key}
              label={group.label}
              chip={group.chip}
              skills={profile.skills[group.key]}
            />
          ))}
        </section>
      ) : profile.isOwner ? (
        <p className="border-t border-border pt-5 text-body text-foreground-secondary">
          Add the skills you&apos;re into, can help with or want to learn.{" "}
          <Link href="/settings/skills" className="font-bold text-link hover:underline">
            Add skills
          </Link>
        </p>
      ) : null}

      <ProfileTabs
        username={profile.username}
        isOwner={profile.isOwner}
        posts={posts}
        drafts={drafts}
        projects={projects}
        collections={
          <>
            {profile.isOwner ? (
              <p className="text-meta text-foreground-secondary">
                Only public collections show here.{" "}
                <Link href="/saved" className="font-bold text-link hover:underline">
                  Manage collections in Saved
                </Link>
              </p>
            ) : null}
            {profile.publicCollections.length > 0 ? (
              <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {profile.publicCollections.map((collection) => (
                  <li key={collection.id}>
                    <CollectionTile collection={collection} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-body text-foreground-secondary">No public collections yet.</p>
            )}
          </>
        }
      />
      {profile.isOwner ? <AccountActions /> : null}
    </div>
  );
}
