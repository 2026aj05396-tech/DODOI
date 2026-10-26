import { Suspense } from "react";

import { AdminPageSkeleton } from "@/components/admin/admin-page-skeleton";
import { SkillEditor } from "@/components/admin/skill-editor";
import { getActor } from "@/server/auth";
import { orNotFound } from "@/server/lib/not-found";
import { getMedia } from "@/server/modules/content";
import { getAdminSkill, listAdminSkills } from "@/server/modules/skills";

type Params = PageProps<"/admin/skills/[id]">["params"];

export default function EditAdminSkillPage({ params }: PageProps<"/admin/skills/[id]">) {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <EditSkill params={params} />
    </Suspense>
  );
}

async function EditSkill({ params }: { params: Params }) {
  const actor = await getActor();
  const { id } = await params;
  const [skill, skills] = await Promise.all([
    orNotFound(getAdminSkill(actor, id)),
    listAdminSkills(actor),
  ]);
  const cover = skill.coverMediaId ? await getMedia(skill.coverMediaId) : null;
  return (
    <SkillEditor key={`${skill.id}-${skill.status}`} skill={skill} cover={cover} skills={skills} />
  );
}
