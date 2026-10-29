import { EyeOff, Pencil, Sparkles } from "lucide-react";
import Link from "next/link";

import { CommentsSection } from "@/components/comments/comments-section";
import { StartProjectButton } from "@/components/journal/start-project-button";
import { PostMenu } from "@/components/safety/post-menu";
import { SkillChipLink } from "@/components/skills/skill-chip-link";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/chip";
import type { FollowState } from "@/lib/types/follows";
import type { PostLikeState } from "@/lib/types/likes";
import type {
  PostCard as PostCardData,
  PostDetail as PostDetailData,
  PostProgress,
} from "@/lib/types/posts";
import { cn } from "@/lib/utils/cn";
import { formatMinutes, levelLabel } from "@/lib/utils/post-labels";

import { AttributionBlock } from "./attribution-block";
import { ComingSoonAction } from "./coming-soon-action";
import { CreatorRow } from "./creator-row";
import { LikeButton } from "./like-button";
import { PostCard } from "./post-card";
import { PostGallery } from "./post-gallery";
import { SaveToCollectionButton } from "./save-to-collection-button";
import { ShareButton } from "./share-button";
import { TutorialSections } from "./tutorial-sections";

// Post detail (P1-20, POST-01…10, POST-13; designs `1e` mobile and `2c` web, tablet built from the
// system). Mobile: full-width media with Back and Share on top, details below, a sticky action bar.
// Tablet: media above details in a centred column. From 1024px: side by side, media sticky.
// Optional fields render nothing (POST-10). Materials and steps carry the user's progress
// (P1-20b, `TutorialSections`). Skill chips open skill pages (P1-26).

/** Two equal buttons side by side, their text wrapping like the design (`2c`). */
const WRAPPING_ACTION = "h-auto min-h-11 py-2 text-center leading-tight whitespace-normal";

/** Edit on the maker's own post (F-17 step 7): opens the Create flow on Details. */
function EditPostLink({ postId, className }: { postId: string; className?: string }) {
  return (
    <Button asChild variant="outline" className={className}>
      <Link href={`/create/${postId}`}>
        <Pencil aria-hidden className="size-4" />
        Edit post
      </Link>
    </Button>
  );
}

export function PostDetail({
  post,
  related,
  progress,
  commentCount,
  isEmailVerified,
  like,
  follow,
}: {
  post: PostDetailData;
  related: PostCardData[];
  /** The signed-in user's ticks; null for signed-out visitors. */
  progress: PostProgress | null;
  /** Comments and replies shown on the post (CMT-04, public). */
  commentCount: number;
  /** Writing comments needs a verified email (OD-08). */
  isEmailVerified: boolean;
  /** The viewer's like; null for signed-out visitors. */
  like: PostLikeState | null;
  /** Follow button state for the creator; null for signed-out visitors. */
  follow: FollowState | null;
}) {
  const path = `/p/${post.id}`;
  const skills = [...post.skills].sort(
    (a, b) => Number(b.id === post.primarySkillId) - Number(a.id === post.primarySkillId),
  );

  return (
    <div className="pb-28 md:pb-14">
      {/* From 768px Back sits above the post; phones have the round one over the photo. */}
      <div className="hidden md:mx-auto md:flex md:max-w-2xl md:px-7 md:pt-4 lg:max-w-6xl xl:px-10">
        <BackButton fallbackHref="/" />
      </div>
      <article className="md:mx-auto md:max-w-2xl md:px-7 md:pt-2 lg:grid lg:max-w-6xl lg:grid-cols-2 lg:items-start lg:gap-9 xl:gap-12 xl:px-10 xl:pt-2">
        <div className="relative lg:sticky lg:top-8">
          <PostGallery
            media={post.media}
            frameClassName="max-h-[56svh] md:rounded-card lg:max-h-none"
          />
          <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-between p-4 md:hidden">
            <BackButton fallbackHref="/" appearance="overlay" className="pointer-events-auto" />
            <ShareButton
              title={post.title}
              path={path}
              variant="overlay"
              className="pointer-events-auto"
            />
          </div>
        </div>

        <div className="flex flex-col gap-6 px-5 pt-5 md:px-0 md:pt-7 lg:pt-0">
          {post.isHidden ? (
            <p
              role="status"
              className="flex items-start gap-2.5 rounded-card bg-destructive-surface p-4 text-body text-foreground"
            >
              <EyeOff aria-hidden className="mt-0.5 size-4.5 shrink-0" />
              <span>
                <span className="font-bold">Hidden after a report.</span> Only its author and our
                team can see this post.
              </span>
            </p>
          ) : null}
          <header className="flex flex-col gap-3">
            <ul className="flex flex-wrap gap-1.5" aria-label="About this post">
              {skills.map((skill) => (
                <li key={skill.id}>
                  <SkillChipLink skill={skill} />
                </li>
              ))}
              {post.difficulty ? (
                <li>
                  <Tag>{levelLabel(post.difficulty)}</Tag>
                </li>
              ) : null}
              {post.estimatedMinutes ? (
                <li>
                  <Tag>{formatMinutes(post.estimatedMinutes)}</Tag>
                </li>
              ) : null}
            </ul>
            <h1 className="text-title text-balance text-foreground md:text-title-web">
              {post.title}
            </h1>
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <CreatorRow
                  creator={post.creator}
                  isOwn={post.isOwn}
                  follow={follow}
                  returnTo={path}
                />
              </div>
              {like !== null && !post.isOwn ? (
                <PostMenu
                  postId={post.id}
                  creator={
                    post.creator
                      ? { username: post.creator.username, displayName: post.creator.displayName }
                      : null
                  }
                />
              ) : null}
            </div>
            {post.isOwn ? (
              // Your own post says whether others can see it (PO decision 2026-10-29).
              <p className="inline-flex items-center gap-2 text-meta text-foreground-secondary">
                <span
                  aria-hidden
                  className={cn(
                    "size-2 rounded-full",
                    post.isPublished ? "bg-success" : "bg-border-strong",
                  )}
                />
                {post.isPublished ? "Live · showing in feeds" : "Draft · only you can see this"}
              </p>
            ) : null}
          </header>

          <div className="hidden grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2.5 md:grid">
            <LikeButton
              postId={post.id}
              initialLiked={like?.isLiked ?? false}
              isSignedIn={like !== null}
            />
            <SaveToCollectionButton
              postId={post.id}
              postTitle={post.title}
              isSignedIn={progress !== null}
              className={WRAPPING_ACTION}
            />
            {post.isOwn ? (
              <EditPostLink postId={post.id} className={WRAPPING_ACTION} />
            ) : post.type === "TUTORIAL" ? (
              <StartProjectButton
                postId={post.id}
                isSignedIn={progress !== null}
                className={WRAPPING_ACTION}
              />
            ) : (
              <ComingSoonAction
                label="Start as my project"
                shape="outline"
                className={WRAPPING_ACTION}
              />
            )}
            <ShareButton title={post.title} path={path} variant="outline" />
          </div>

          {like?.likeCount != null ? (
            <p className="text-body text-foreground-secondary">
              {like.likeCount === 1 ? "1 like" : `${like.likeCount} likes`}
            </p>
          ) : null}

          {post.description ? (
            <p className="text-body-lg whitespace-pre-line text-foreground md:text-body-lg-web">
              {post.description}
            </p>
          ) : null}

          <TutorialSections
            postId={post.id}
            materials={post.materials}
            steps={post.steps}
            initialProgress={progress}
          />

          {post.attribution ? <AttributionBlock attribution={post.attribution} /> : null}

          <CommentsSection
            postId={post.id}
            initialCount={commentCount}
            isSignedIn={progress !== null}
            isVerified={isEmailVerified}
            placement="column"
          />
        </div>
      </article>

      {related.length > 0 ? (
        <section
          aria-labelledby="related-posts"
          className="mx-auto max-w-6xl px-5 pt-10 md:px-7 md:pt-14 xl:px-10"
        >
          <h2 id="related-posts" className="text-section text-foreground">
            More like this
          </h2>
          <div className="mt-4 columns-2 gap-3 md:gap-4 xl:columns-3">
            {related.map((card) => (
              <PostCard
                key={card.id}
                post={card}
                isSignedIn={progress !== null}
                className="mb-5 break-inside-avoid"
              />
            ))}
          </div>
        </section>
      ) : null}

      <CommentsSection
        postId={post.id}
        initialCount={commentCount}
        isSignedIn={progress !== null}
        isVerified={isEmailVerified}
        placement="page"
      />

      <div className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-[auto_1fr_1fr] items-center gap-3 border-t border-muted bg-background px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] md:hidden">
        <LikeButton
          postId={post.id}
          initialLiked={like?.isLiked ?? false}
          isSignedIn={like !== null}
        />
        {post.isOwn ? (
          <EditPostLink postId={post.id} className="h-13 px-3" />
        ) : post.type === "TUTORIAL" ? (
          <StartProjectButton
            postId={post.id}
            isSignedIn={progress !== null}
            className="h-13 px-3 leading-tight whitespace-normal"
          />
        ) : (
          <ComingSoonAction
            label="Ask about this"
            shape="outline"
            badge="dot"
            icon={<Sparkles aria-hidden className="size-4" />}
            className="h-13 px-3"
          />
        )}
        <SaveToCollectionButton
          postId={post.id}
          postTitle={post.title}
          isSignedIn={progress !== null}
          className="h-13 px-3"
        />
      </div>
    </div>
  );
}
