import { Suspense } from "react";

import { AdminPageSkeleton } from "@/components/admin/admin-page-skeleton";
import { ThemeEditor } from "@/components/admin/theme-editor";
import type { AdminPostSummary } from "@/lib/types/admin";
import { getActor } from "@/server/auth";
import type { Actor } from "@/server/lib/actor";
import { orNotFound } from "@/server/lib/not-found";
import { getAdminTheme, listAdminPosts } from "@/server/modules/content";

/** Every post (a few hundred at most in Phase 1), to pick from. */
async function allPosts(actor: Actor): Promise<AdminPostSummary[]> {
  const posts: AdminPostSummary[] = [];
  let cursor: string | undefined;
  do {
    const page = await listAdminPosts(actor, { limit: 50, cursor });
    posts.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return posts;
}

type Params = PageProps<"/admin/themes/[id]">["params"];

export default function EditAdminThemePage({ params }: PageProps<"/admin/themes/[id]">) {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <EditTheme params={params} />
    </Suspense>
  );
}

async function EditTheme({ params }: { params: Params }) {
  const actor = await getActor();
  const { id } = await params;
  const [theme, posts] = await Promise.all([orNotFound(getAdminTheme(actor, id)), allPosts(actor)]);
  return <ThemeEditor key={theme.id} theme={theme} posts={posts} />;
}
