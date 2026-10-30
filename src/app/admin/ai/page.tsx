import { Suspense } from "react";

import { AiUsageDashboard } from "@/components/admin/ai-usage-dashboard";
import { Skeleton } from "@/components/ui/skeleton";
import { getActor } from "@/server/auth";
import { getAiSwitch, getUsageReport } from "@/server/modules/ai";

// Admin AI usage and kill switch (P4-05, AIC-10). Admins only: the proxy and the services answer
// 404 to everyone else, moderators included.
export default function AdminAiPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-card" />}>
      <AdminAiContent />
    </Suspense>
  );
}

async function AdminAiContent() {
  const actor = await getActor();
  const [report, switchState] = await Promise.all([getUsageReport(actor, {}), getAiSwitch(actor)]);
  return <AiUsageDashboard initialReport={report} initialSwitch={switchState} />;
}
