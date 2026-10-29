"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { showToast } from "@/components/ui/toast";
import { followUser, unfollowUser } from "@/lib/api-client/follows";
import { ApiRequestError } from "@/lib/api-client/request";
import { cn } from "@/lib/utils/cn";

// Follow / Following (P2-06, FLW-01, F-20 step 2): shows the new state at once and puts it back
// with a toast if the request fails. Signed-out visitors go to sign-in and come back (OD-29).
// `text` is the brick text action in the creator row; `outline` is the profile and list button.

export function FollowButton({
  username,
  displayName,
  initialFollowing,
  isSignedIn,
  returnTo,
  appearance = "outline",
  className,
}: {
  username: string;
  displayName: string;
  initialFollowing: boolean;
  isSignedIn: boolean;
  /** Where sign-in sends a signed-out visitor back to. */
  returnTo: string;
  appearance?: "text" | "outline";
  className?: string;
}) {
  const [isFollowing, setIsFollowing] = useState(initialFollowing);
  const [isBusy, setIsBusy] = useState(false);
  const textStyle =
    "inline-flex min-h-11 items-center rounded-sm px-1 text-control font-bold text-link hover:underline";

  if (!isSignedIn) {
    return appearance === "text" ? (
      <Link
        href={`/sign-in?returnTo=${encodeURIComponent(returnTo)}`}
        className={cn(textStyle, className)}
      >
        Follow
      </Link>
    ) : (
      <Button asChild variant="outline" size="sm" className={className}>
        <Link href={`/sign-in?returnTo=${encodeURIComponent(returnTo)}`}>Follow</Link>
      </Button>
    );
  }

  async function toggle() {
    const next = !isFollowing;
    setIsFollowing(next);
    setIsBusy(true);
    try {
      await (next ? followUser(username) : unfollowUser(username));
    } catch (error) {
      setIsFollowing(!next);
      showToast({
        message:
          error instanceof ApiRequestError ? error.message : "We couldn't update that. Try again.",
      });
    } finally {
      setIsBusy(false);
    }
  }

  const label = isFollowing ? "Following" : "Follow";
  const common = {
    "aria-pressed": isFollowing,
    "aria-label": `${label} ${displayName}`,
    disabled: isBusy,
    onClick: () => void toggle(),
  };
  return appearance === "text" ? (
    <button
      type="button"
      {...common}
      className={cn(textStyle, isFollowing && "text-muted-foreground", className)}
    >
      {label}
    </button>
  ) : (
    <Button
      type="button"
      variant="outline"
      size="sm"
      {...common}
      className={cn(isFollowing && "text-foreground-secondary", className)}
    >
      {label}
    </Button>
  );
}
