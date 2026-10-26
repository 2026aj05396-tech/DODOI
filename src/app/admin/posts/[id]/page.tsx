import { Suspense } from "react";

import { AdminPageSkeleton } from "@/components/admin/admin-page-skeleton";
import { PostEditor } from "@/components/admin/post-editor";
import { getActor } from "@/server/auth";
import { orNotFound } from "@/server/lib/not-found";
import { getAdminPost } from "@/server/modules/content";
import { listAdminSkills } from "@/server/modules/skills";

type Params = PageProps<"/admin/posts/[id]">["params"];

export default function EditAdminPostPage({ params }: PageProps<"/admin/posts/[id]">) {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <EditPostEditor params={params} />
    </Suspense>
  );
}

async function EditPostEditor({ params }: { params: Params }) {
  const actor = await getActor();
  const { id } = await params;
  const [post, skills] = await Promise.all([
    orNotFound(getAdminPost(actor, id)),
    listAdminSkills(actor),
  ]);
  return <PostEditor post={post} skills={skills} />;
}
