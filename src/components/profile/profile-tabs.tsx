"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { DraftsStrip } from "@/components/create/drafts-strip";
import { ProjectCard } from "@/components/journal/project-card";
import { InfinitePostGrid } from "@/components/posts/infinite-post-grid";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getProfilePosts } from "@/lib/api-client/own-posts";
import type { Paginated } from "@/lib/types/api";
import type { ProjectSummary } from "@/lib/types/journal";
import type { OwnPostSummary, PostCard } from "@/lib/types/posts";

// Profile tabs (`1i`): Projects (P2-03) · Collections · Posts (P2-02). Posts opens first when there
// are any, then Projects; the owner also sees their drafts on Posts and private projects on Projects.

export function ProfileTabs({
  username,
  isOwner,
  posts,
  drafts,
  projects,
  collections,
}: {
  /** Public projects (all of them for the owner). */
  projects: ProjectSummary[];
  username: string;
  isOwner: boolean;
  posts: Paginated<PostCard>;
  /** The owner's drafts; empty for everyone else. */
  drafts: OwnPostSummary[];
  /** The Collections tab, rendered on the server. */
  collections: ReactNode;
}) {
  const hasPosts = posts.items.length > 0 || drafts.length > 0;
  const firstTab = hasPosts ? "posts" : projects.length > 0 ? "projects" : "collections";

  return (
    <Tabs defaultValue={firstTab} className="flex flex-col gap-4">
      <TabsList aria-label="Profile" className="gap-6 text-control-lg">
        <TabsTrigger value="projects">Projects</TabsTrigger>
        <TabsTrigger value="collections">Collections</TabsTrigger>
        <TabsTrigger value="posts">Posts</TabsTrigger>
      </TabsList>

      <TabsContent value="projects" className="flex flex-col gap-4">
        {projects.length > 0 ? (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3">
            {projects.map((project) => (
              <li key={project.id}>
                <ProjectCard project={project} />
              </li>
            ))}
          </ul>
        ) : isOwner ? (
          <EmptyState
            title="Keep a journal of what you make"
            titleAs="h3"
            description="Projects you show on your profile appear here."
            action={
              <Button asChild variant="outline">
                <Link href="/journal">Open your journal</Link>
              </Button>
            }
          />
        ) : (
          <EmptyState title="No projects yet" titleAs="h3" />
        )}
      </TabsContent>

      <TabsContent value="collections" className="flex flex-col gap-4">
        {collections}
      </TabsContent>

      <TabsContent value="posts" className="flex flex-col gap-6">
        {isOwner ? <DraftsStrip drafts={drafts} heading="Your drafts" /> : null}
        <InfinitePostGrid
          queryKey={["profile-posts", username]}
          fetchPage={(cursor) => getProfilePosts(username, cursor)}
          initialPage={posts}
          empty={
            isOwner ? (
              <EmptyState
                title="Share something you made"
                titleAs="h3"
                description="A first attempt, a work in progress or a finished make: it all counts."
                action={
                  <Button asChild>
                    <Link href="/create">
                      <Plus aria-hidden className="size-4.5" />
                      Create a post
                    </Link>
                  </Button>
                }
              />
            ) : (
              <EmptyState title="No posts yet" titleAs="h3" />
            )
          }
        />
      </TabsContent>
    </Tabs>
  );
}
