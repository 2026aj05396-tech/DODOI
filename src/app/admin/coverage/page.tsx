import { Suspense } from "react";

import { AdminPageSkeleton } from "@/components/admin/admin-page-skeleton";
import { SeedCoverageView } from "@/components/admin/seed-coverage-view";
import { getActor } from "@/server/auth";
import { getSeedCoverage } from "@/server/modules/content";

// Admin Coverage (P1-19): published content against the OD-31 launch minimums.
export default function AdminCoveragePage() {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <AdminCoverage />
    </Suspense>
  );
}

async function AdminCoverage() {
  return <SeedCoverageView coverage={await getSeedCoverage(await getActor())} />;
}
