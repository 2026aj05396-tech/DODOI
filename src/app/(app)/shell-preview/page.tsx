import { Users, Video } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageWithRail } from "@/components/layout/page-with-rail";
import { ComingSoonCard } from "@/components/ui/coming-soon";
import { PATTERN_ACCENTS, PatternTile } from "@/components/ui/pattern-tile";
import { serverEnv } from "@/server/lib/env";

export const metadata: Metadata = {
  title: "App shell · dodoi",
  robots: { index: false, follow: false },
};

const TILE_HEIGHTS = ["h-52", "h-38", "h-64", "h-44", "h-56", "h-40"];

// Developer preview of the app shell (roadmap P1-26b). Local development only.
export default function ShellPreviewPage() {
  if (serverEnv.APP_ENV !== "local") {
    notFound();
  }

  return (
    <PageWithRail
      rail={
        <>
          <ComingSoonCard
            icon={<Users />}
            title="Help other makers"
            description="Answer questions in skills you know."
          />
          <ComingSoonCard
            icon={<Video />}
            title="Live sessions"
            description="Book a 30-min call with a maker. We'll let you know when this opens."
          />
        </>
      }
    >
      <div className="flex flex-col gap-4 px-5 pt-4 md:px-7 md:pt-6">
        <h1 className="text-greeting md:text-greeting-web">App shell preview</h1>
        <div className="columns-2 gap-2.5 md:gap-4 xl:columns-3">
          {PATTERN_ACCENTS.map((accent, index) => (
            <PatternTile
              key={accent}
              accent={accent}
              className={`mb-3 break-inside-avoid ${TILE_HEIGHTS[index] ?? "h-40"}`}
            />
          ))}
        </div>
      </div>
    </PageWithRail>
  );
}
