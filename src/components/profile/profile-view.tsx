import { Lock, Settings } from "lucide-react";
import Link from "next/link";

import { CollectionTile } from "@/components/collections/collection-tile";
import { ComingSoonTrigger } from "@/components/layout/coming-soon-trigger";
import { Button } from "@/components/ui/button";
import { ComingSoonBadge } from "@/components/ui/coming-soon";
import type { ProfileSkill, ProfileView as ProfileViewData } from "@/lib/types/me";
import { cn } from "@/lib/utils/cn";
import { levelLabel } from "@/lib/utils/post-labels";

import { Avatar } from "./avatar";
import { UsernamePrompt } from "./username-prompt";

// Public profile (`/u/{username}`, PRF-05…08; design `1i`, tablet/desktop built from the system).
// Skill groups follow DC-08: Can help with (coral), Want to learn (butter), Interests (outline).
// Tabs: Collections works; Projects and Posts arrive in Phase 2 (PO decision, P1-14).

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
          <li key={skill.id} className={cn("rounded-full px-3 py-1.5 text-chip", chip)}>
            {skill.name}
            {level ? (
              <span className="font-normal text-foreground-secondary"> · {levelLabel(level)}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Header({
  profile,
  isOwner,
}: {
  profile: { displayName: string; username: string; avatarUrl: string | null };
  isOwner: boolean;
}) {
  return (
    <header className="flex flex-col gap-4">
      <div className="flex items-center gap-4 md:gap-6">
        <Avatar url={profile.avatarUrl} className="size-22 shrink-0 md:size-28" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="text-greeting break-words text-foreground md:text-greeting-web">
            {profile.displayName}
          </h1>
          <p className="text-body text-foreground-secondary">@{profile.username}</p>
        </div>
      </div>
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

export function ProfileView({
  profile,
  showUsernamePrompt,
}: {
  profile: ProfileViewData;
  showUsernamePrompt: boolean;
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
      <Header profile={profile} isOwner={profile.isOwner} />
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

      <section aria-labelledby="profile-collections" className="flex flex-col gap-4">
        <div className="flex items-end gap-6 border-b border-border">
          <ComingSoonTrigger
            label="Projects"
            hasVisibleLabel
            className="flex items-center gap-1.5 pb-2.5 text-control-lg text-muted-foreground"
          >
            Projects
            <ComingSoonBadge size="sm" decorative />
          </ComingSoonTrigger>
          <h2
            id="profile-collections"
            className="-mb-px border-b-2 border-link pb-2.5 text-control-lg font-bold text-link"
          >
            Collections
          </h2>
          <ComingSoonTrigger
            label="Posts"
            hasVisibleLabel
            className="flex items-center gap-1.5 pb-2.5 text-control-lg text-muted-foreground"
          >
            Posts
            <ComingSoonBadge size="sm" decorative />
          </ComingSoonTrigger>
        </div>
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
      </section>
    </div>
  );
}
