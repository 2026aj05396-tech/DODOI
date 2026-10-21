import type { ReactNode } from "react";

export type PageWithRailProps = {
  children: ReactNode;
  /** Shown as a 300px right rail on desktop (≥ 1280px) only (`2b`); hidden on tablet and mobile (`3c`). */
  rail: ReactNode;
};

export function PageWithRail({ children, rail }: PageWithRailProps) {
  return (
    <div className="flex min-h-full">
      <div className="min-w-0 flex-1">{children}</div>
      <aside
        aria-label="Suggestions"
        className="sticky top-0 hidden h-dvh w-75 shrink-0 flex-col gap-4.5 overflow-y-auto border-l border-border bg-background px-5 py-6 xl:flex"
      >
        {rail}
      </aside>
    </div>
  );
}
