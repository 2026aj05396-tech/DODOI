import { Suspense } from "react";

import { AdminPageSkeleton } from "@/components/admin/admin-page-skeleton";
import { PostList } from "@/components/admin/post-list";
import { getActor } from "@/server/auth";
import { listAdminPosts } from "@/server/modules/content";

// Admin post list (P1-17). The admin layout has already checked the role.
export default function AdminPostsPage() {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <AdminPosts />
    </Suspense>
  );
}

async function AdminPosts() {
  const page = await listAdminPosts(await getActor(), { limit: 20 });
  return <PostList initialPage={page} />;
}
