import { Suspense } from "react";

import { AdminPageSkeleton } from "@/components/admin/admin-page-skeleton";
import { ThemeList } from "@/components/admin/theme-list";
import { getActor } from "@/server/auth";
import { listAdminThemes } from "@/server/modules/content";

export default function AdminThemesPage() {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <AdminThemes />
    </Suspense>
  );
}

async function AdminThemes() {
  return <ThemeList themes={await listAdminThemes(await getActor())} />;
}
