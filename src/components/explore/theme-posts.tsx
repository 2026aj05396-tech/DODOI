"use client";

import { InfinitePostGrid } from "@/components/posts/infinite-post-grid";
import { EmptyState } from "@/components/ui/empty-state";
import { getThemePosts } from "@/lib/api-client/search";
import type { Paginated } from "@/lib/types/api";
import type { PostCard } from "@/lib/types/posts";

/** A theme's posts in the editors' order, paged (theme page). */
export function ThemePosts({
  slug,
  initialPage,
}: {
  slug: string;
  initialPage: Paginated<PostCard>;
}) {
  return (
    <InfinitePostGrid
      queryKey={["theme-posts", slug]}
      fetchPage={(cursor) => getThemePosts(slug, cursor)}
      initialPage={initialPage}
      empty={<EmptyState title="No ideas here yet" titleAs="h2" description="Check back soon." />}
    />
  );
}
