"use client";

import type { PostCard as PostCardData } from "@/lib/types/posts";

import { Masonry, cardHeight } from "./masonry";
import { PostCard } from "./post-card";

/** A fixed list of post cards in the masonry (e.g. Explore's beginner-friendly projects). */
export function PostGrid({ posts }: { posts: PostCardData[] }) {
  return (
    <Masonry
      items={posts}
      getKey={(post) => post.id}
      getHeight={(post) => cardHeight(post.coverMedia.width, post.coverMedia.height)}
      renderItem={(post) => <PostCard post={post} isSignedIn />}
    />
  );
}
