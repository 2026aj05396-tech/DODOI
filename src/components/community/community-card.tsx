import Link from "next/link";

import { PatternTile, type PatternAccent } from "@/components/ui/pattern-tile";
import type { CommunityCard as CommunityCardData } from "@/lib/types/communities";
import { cn } from "@/lib/utils/cn";

// A community in a list (UI_UX_GUIDELINES §8.3): a pattern tile in the skill's accent (no photos),
// the name, the craft and a short description. No member counts (PP-4). The whole card is one link.

const ROLE_LABEL = { OWNER: "Owner", MODERATOR: "Moderator", MEMBER: "Joined" } as const;

export function CommunityCard({
  community,
  className,
}: {
  community: CommunityCardData;
  className?: string;
}) {
  const accent = (community.skill?.accent.toLowerCase() ?? "butter") as PatternAccent;
  return (
    <article
      className={cn(
        "relative flex gap-3.5 rounded-card border border-border bg-background p-4 hover:border-border-strong",
        className,
      )}
    >
      <PatternTile accent={accent} className="size-14 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="min-w-0 text-card-title-web text-foreground">
            <Link
              href={`/community/circles/${community.slug}`}
              className="rounded-sm wrap-break-word after:absolute after:inset-0 after:rounded-card"
            >
              {community.name}
            </Link>
          </h3>
          {community.myRole ? (
            <span className="rounded-full bg-mint px-2.5 py-0.5 text-meta font-bold text-foreground">
              {ROLE_LABEL[community.myRole]}
            </span>
          ) : null}
        </div>
        {community.skill ? (
          <p className="text-meta font-bold text-plum">{community.skill.name}</p>
        ) : null}
        <p className="line-clamp-2 text-body wrap-break-word text-foreground-secondary">
          {community.description}
        </p>
      </div>
    </article>
  );
}
