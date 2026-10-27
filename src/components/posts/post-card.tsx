import Link from "next/link";
import type { ReactNode } from "react";

import type { PatternAccent } from "@/components/ui/pattern-tile";
import type { PostCard as PostCardData } from "@/lib/types/posts";
import { cn } from "@/lib/utils/cn";
import { postTypeLabel } from "@/lib/utils/post-labels";

import { CardImage } from "./card-image";
import { CardVideo } from "./card-video";
import { SaveButton } from "./save-button";

// Post card (UI_UX_GUIDELINES §4, `1c`/`2b`): media with the type badge top-left and the save
// button top-right, then title and `creator · skill`. Used for related posts (P1-20) and the feed
// (P1-22, which adds the "⋯" menu through `menu`). Save, video play and the menu sit outside the
// link so the card has no nested interactive elements.

/** Card media keeps the cover's shape between 3:4 and 4:3, so the masonry never jumps. */
export function coverRatio(width: number, height: number): number {
  if (height === 0) return 1;
  return Math.min(4 / 3, Math.max(3 / 4, width / height));
}

export function PostCard({
  post,
  isSignedIn,
  menu,
  isAboveFold = false,
  className,
}: {
  post: PostCardData;
  isSignedIn: boolean;
  /** Among the first cards on screen: its image loads straight away with high priority (LCP). */
  isAboveFold?: boolean;
  /** The "⋯" menu at the end of the byline (feed only). */
  menu?: ReactNode;
  className?: string;
}) {
  const primarySkill =
    post.skills.find((skill) => skill.id === post.primarySkillId) ?? post.skills[0];
  const byline = [post.creator?.displayName ?? "dodoi editors", primarySkill?.name]
    .filter(Boolean)
    .join(" · ");
  const cover = post.coverMedia;
  const ratio = coverRatio(cover.width, cover.height);
  const accent = (primarySkill?.accent.toLowerCase() ?? "butter") as PatternAccent;

  return (
    <article className={cn("group relative", className)}>
      <Link href={`/p/${post.id}`} className="block rounded-card">
        <div
          className="relative overflow-hidden rounded-card bg-muted transition-shadow duration-150 group-hover:shadow-hover"
          style={{ aspectRatio: ratio }}
        >
          <CardImage media={cover} fallback={accent} isAboveFold={isAboveFold} />
          <span className="absolute top-2.5 left-2.5 max-w-[calc(100%-3.5rem)] truncate rounded-full bg-background px-2.5 py-1 text-badge tracking-normal text-foreground">
            {postTypeLabel(post.type, post.estimatedMinutes)}
          </span>
        </div>
        <h3
          className={cn(
            "mt-2 text-card-title text-foreground md:text-card-title-web",
            menu && "pr-9",
          )}
        >
          {post.title}
        </h3>
        <p
          className={cn(
            "mt-0.5 text-meta text-foreground-secondary md:text-meta-web",
            menu && "pr-9",
          )}
        >
          {byline}
        </p>
      </Link>
      {cover.type === "VIDEO" ? (
        <div
          className="pointer-events-none absolute inset-x-0 top-0"
          style={{ aspectRatio: ratio }}
        >
          <CardVideo media={cover} title={post.title} />
        </div>
      ) : null}
      <SaveButton
        postId={post.id}
        postTitle={post.title}
        initialSaved={post.isSaved}
        isSignedIn={isSignedIn}
        className="absolute top-2 right-2"
      />
      {menu ? <div className="absolute right-0 bottom-0">{menu}</div> : null}
    </article>
  );
}
