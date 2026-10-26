import type { Metadata } from "next";
import { Suspense } from "react";

import { PostDetail } from "@/components/posts/post-detail";
import { Skeleton } from "@/components/ui/skeleton";
import { getActor } from "@/server/auth";
import { NotFoundError } from "@/server/lib/errors";
import { orNotFound } from "@/server/lib/not-found";
import { getPostDetail, getRelatedPosts } from "@/server/modules/content";

type Params = PageProps<"/p/[id]">["params"];

/** Title, description and preview image for shared links (published posts only). */
export async function generateMetadata({ params }: PageProps<"/p/[id]">): Promise<Metadata> {
  const { id } = await params;
  try {
    const post = await getPostDetail(null, id);
    const cover = post.coverMedia;
    return {
      title: `${post.title} · dodoi`,
      description: post.description?.slice(0, 160) ?? undefined,
      openGraph: {
        title: post.title,
        images: [{ url: cover.posterUrl ?? cover.url, alt: cover.altText ?? undefined }],
      },
    };
  } catch (error) {
    if (error instanceof NotFoundError) return { title: "Post not found · dodoi" };
    throw error;
  }
}

// Post detail (P1-20). Published posts are public; admins can also preview drafts.
export default function PostPage({ params }: PageProps<"/p/[id]">) {
  return (
    <Suspense fallback={<PostSkeleton />}>
      <PostContent params={params} />
    </Suspense>
  );
}

async function PostContent({ params }: { params: Params }) {
  const actor = await getActor();
  const { id } = await params;
  const [post, related] = await Promise.all([
    orNotFound(getPostDetail(actor, id)),
    orNotFound(getRelatedPosts(actor, id)),
  ]);
  return <PostDetail post={post} related={related} />;
}

function PostSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="md:mx-auto md:max-w-2xl md:px-7 md:pt-8 lg:grid lg:max-w-6xl lg:grid-cols-2 lg:gap-9 xl:gap-12 xl:px-10 xl:pt-10"
    >
      <Skeleton className="aspect-square max-h-[56svh] w-full rounded-none md:rounded-card lg:max-h-none" />
      <div className="flex flex-col gap-4 px-5 pt-5 md:px-0 md:pt-7 lg:pt-0">
        <Skeleton className="h-7 w-48 rounded-full" />
        <Skeleton className="h-9 w-4/5 rounded-md" />
        <Skeleton className="h-9 w-56 rounded-md" />
        <Skeleton className="h-40 w-full rounded-card" />
      </div>
    </div>
  );
}
