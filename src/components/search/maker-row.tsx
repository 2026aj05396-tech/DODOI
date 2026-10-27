import Link from "next/link";

import { Avatar } from "@/components/profile/avatar";
import type { CreatorSummary } from "@/lib/types/posts";

/** A maker in search results: photo, name and @username, opening their profile. */
export function MakerRow({ maker }: { maker: CreatorSummary }) {
  return (
    <Link
      href={`/u/${maker.username}`}
      className="flex min-h-16 items-center gap-3 rounded-card px-2 py-2 hover:bg-muted"
    >
      <Avatar url={maker.avatarUrl} className="size-11 shrink-0" />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-control-lg font-bold text-foreground">
          {maker.displayName}
        </span>
        <span className="truncate text-meta text-foreground-secondary">@{maker.username}</span>
      </span>
    </Link>
  );
}
