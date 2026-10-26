import { Bookmark, Play } from "lucide-react";
import Link from "next/link";

import { ComingSoonTrigger } from "@/components/layout/coming-soon-trigger";
import { ComingSoonBadge } from "@/components/ui/coming-soon";
import type { PostCard as PostCardData } from "@/lib/types/posts";
import { cn } from "@/lib/utils/cn";
import { postTypeLabel } from "@/lib/utils/post-labels";

// Post card (UI_UX_GUIDELINES §4, `1c`/`2b`): media with the type badge top-left and the save
// button top-right, then title and `creator · skill`. Built for related posts (P1-20); the feed
// (P1-22) reuses it. Save is "coming soon" until P1-25. The save button sits outside the link so
// the card has no nested interactive elements.

/** Card media keeps the cover's shape between 3:4 and 4:3, so the masonry never jumps. */
function coverRatio(width: number, height: number): number {
  if (height === 0) return 1;
  return Math.min(4 / 3, Math.max(3 / 4, width / height));
}

export function PostCard({ post, className }: { post: PostCardData; className?: string }) {
  const primarySkill =
    post.skills.find((skill) => skill.id === post.primarySkillId) ?? post.skills[0];
  const byline = [post.creator?.displayName ?? "dodoi editors", primarySkill?.name]
    .filter(Boolean)
    .join(" · ");
  const cover = post.coverMedia;

  return (
    <article className={cn("group relative", className)}>
      <Link href={`/p/${post.id}`} className="block rounded-card">
        <div
          className="relative overflow-hidden rounded-card bg-muted transition-shadow duration-150 group-hover:shadow-hover"
          style={{ aspectRatio: coverRatio(cover.width, cover.height) }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary sizes the image. */}
          <img
            src={cover.posterUrl ?? cover.url}
            alt={cover.altText ?? ""}
            width={cover.width}
            height={cover.height}
            loading="lazy"
            className="size-full object-cover"
          />
          <span className="absolute top-2.5 left-2.5 max-w-[calc(100%-3.75rem)] truncate rounded-full bg-background px-2.5 py-1 text-badge text-foreground">
            {postTypeLabel(post.type, post.estimatedMinutes)}
          </span>
          {cover.type === "VIDEO" ? (
            <span className="absolute bottom-2.5 left-2.5 flex size-8 items-center justify-center rounded-full bg-inverse/80 text-inverse-foreground">
              <Play aria-hidden className="ml-0.5 size-4" fill="currentColor" />
              <span className="sr-only">Video</span>
            </span>
          ) : null}
        </div>
        <h3 className="mt-2 text-card-title text-foreground md:text-card-title-web">
          {post.title}
        </h3>
        <p className="mt-0.5 text-meta text-foreground-secondary md:text-meta-web">{byline}</p>
      </Link>
      <ComingSoonTrigger
        label="Save"
        className="absolute top-2 right-2 flex size-9 items-center justify-center rounded-full bg-background text-muted-foreground"
      >
        <Bookmark aria-hidden className="size-4.5" strokeWidth={1.8} />
        <ComingSoonBadge size="dot" decorative className="absolute top-0.5 right-0.5" />
      </ComingSoonTrigger>
    </article>
  );
}
