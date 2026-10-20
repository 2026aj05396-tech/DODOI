import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { UiPreview } from "@/components/dev/ui-preview";
import { serverEnv } from "@/server/lib/env";

export const metadata: Metadata = {
  title: "UI primitives · dodoi",
  robots: { index: false, follow: false },
};

// Developer preview of the shared primitives (roadmap P0-10). Local development only.
export default function UiPreviewPage() {
  if (serverEnv.APP_ENV !== "local") {
    notFound();
  }
  return <UiPreview />;
}
