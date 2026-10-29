import { FollowButton } from "@/components/profile/follow-button";
import type { FollowState } from "@/lib/types/follows";
import type { CreatorSummary } from "@/lib/types/posts";

// Creator row (`1e`, `2c`, DC-27): avatar, name and Follow (P2-06) for invited
// creators; posts without a dodoi author show a muted "via dodoi editors" line instead. The profile
// link and "helps with …" arrive with profiles (P1-13/P1-14).

export function CreatorRow({
  creator,
  isOwn = false,
  follow,
  returnTo,
}: {
  creator: CreatorSummary | null;
  /** The viewer's own post (P2-02): no Follow for yourself. */
  isOwn?: boolean;
  /** Null for signed-out visitors, who are asked to sign in; `canFollow` false hides the button. */
  follow: FollowState | null;
  returnTo: string;
}) {
  if (!creator) {
    return <p className="text-body text-foreground-secondary">via dodoi editors</p>;
  }
  return (
    <div className="flex items-center gap-3">
      {creator.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- Cloudinary sizes the image.
        <img
          src={creator.avatarUrl}
          alt=""
          width={36}
          height={36}
          className="size-9 shrink-0 rounded-full bg-muted object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-butter text-control font-bold text-foreground"
        >
          {creator.displayName.slice(0, 1).toUpperCase()}
        </span>
      )}
      <p className="min-w-0 flex-1 truncate text-body font-bold text-foreground">
        {creator.displayName}
      </p>
      {isOwn || (follow && !follow.canFollow) ? null : (
        <FollowButton
          username={creator.username}
          displayName={creator.displayName}
          initialFollowing={follow?.isFollowing ?? false}
          isSignedIn={follow !== null}
          returnTo={returnTo}
          appearance="text"
        />
      )}
    </div>
  );
}
