import type { ReactNode } from "react";

import { AskDodoiPill } from "./ask-dodoi";
import { BottomTabBar } from "./bottom-tab-bar";
import { IconRail } from "./icon-rail";
import { MobileHeader } from "./mobile-header";
import { Sidebar } from "./sidebar";

export type AppShellProps = {
  /** Username of the signed-in user for the Profile link; null until auth (P1-04) provides it. */
  username: string | null;
  children: ReactNode;
};

/**
 * Frame for signed-in pages (UI_UX_GUIDELINES §3):
 * mobile (< 768px) header + bottom tabs; tablet (768–1279px) icon rail; desktop (≥ 1280px) sidebar.
 */
export function AppShell({ username, children }: AppShellProps) {
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-full bg-inverse px-4 py-2 text-control font-bold text-inverse-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <MobileHeader />
      <IconRail username={username} className="hidden md:flex xl:hidden" />
      <Sidebar username={username} className="hidden xl:flex" />
      <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 pb-28 outline-none md:pb-0">
        {children}
      </main>
      <AskDodoiPill className="right-4 bottom-25 md:right-6 md:bottom-6 xl:hidden" />
      <BottomTabBar username={username} />
    </div>
  );
}
