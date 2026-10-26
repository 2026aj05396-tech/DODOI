import { Suspense } from "react";

import { AdminPageSkeleton } from "@/components/admin/admin-page-skeleton";
import { SkillList } from "@/components/admin/skill-list";
import { getActor } from "@/server/auth";
import { listAdminSkills } from "@/server/modules/skills";

export default function AdminSkillsPage() {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <AdminSkills />
    </Suspense>
  );
}

async function AdminSkills() {
  return <SkillList skills={await listAdminSkills(await getActor())} />;
}
