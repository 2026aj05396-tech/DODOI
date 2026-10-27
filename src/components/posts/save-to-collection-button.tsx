"use client";

import { usePathname, useRouter } from "next/navigation";

import { openCollectionPicker } from "@/components/collections/collection-picker";
import { cn } from "@/lib/utils/cn";

/**
 * "Save to collection" on the post page (`1e` bar, `2c` actions): opens the collection picker
 * (P1-25); signed-out visitors go to sign-in and come back (OD-29).
 */
export function SaveToCollectionButton({
  postId,
  postTitle,
  isSignedIn,
  className,
}: {
  postId: string;
  postTitle: string;
  isSignedIn: boolean;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <button
      type="button"
      onClick={() => {
        if (isSignedIn) openCollectionPicker({ postId, postTitle });
        else router.push(`/sign-in?returnTo=${encodeURIComponent(pathname)}`);
      }}
      className={cn(
        "inline-flex h-11 min-w-0 items-center justify-center rounded-full bg-primary px-4 text-control font-bold text-primary-foreground transition duration-150 hover:bg-primary-hover active:scale-96",
        className,
      )}
    >
      Save to collection
    </button>
  );
}
