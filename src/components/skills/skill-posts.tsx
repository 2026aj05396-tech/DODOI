"use client";

import { InfinitePostGrid } from "@/components/posts/infinite-post-grid";
import { EmptyState } from "@/components/ui/empty-state";
import { getSkillPosts } from "@/lib/api-client/skills";
import type { Paginated } from "@/lib/types/api";
import type { PostCard } from "@/lib/types/posts";

/** A skill's posts, newest first, paged (skill page, SRCH-06). */
export function SkillPosts({
  slug,
  name,
  initialPage,
}: {
  slug: string;
  name: string;
  initialPage: Paginated<PostCard>;
}) {
  return (
    <InfinitePostGrid
      queryKey={["skill-posts", slug]}
      fetchPage={(cursor) => getSkillPosts(slug, cursor)}
      initialPage={initialPage}
      empty={
        <EmptyState
          title={`No ${name} posts yet`}
          titleAs="h3"
          description="New projects are added every week. Check back soon."
        />
      }
    />
  );
}
