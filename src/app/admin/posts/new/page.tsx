import { Suspense } from "react";

import { AdminPageSkeleton } from "@/components/admin/admin-page-skeleton";
import { PostEditor } from "@/components/admin/post-editor";
import { getActor } from "@/server/auth";
import { listAdminSkills } from "@/server/modules/skills";

export default function NewAdminPostPage() {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <NewPostEditor />
    </Suspense>
  );
}

async function NewPostEditor() {
  const skills = await listAdminSkills(await getActor());
  return <PostEditor post={null} skills={skills} />;
}
