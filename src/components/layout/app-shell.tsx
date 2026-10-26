import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

import { AskDodoiPill } from "./ask-dodoi";
import { BottomTabBar } from "./bottom-tab-bar";
import { IconRail } from "./icon-rail";
import { MobileHeader } from "./mobile-header";
import { Sidebar } from "./sidebar";

export type AppShellProps = {
  /** Username of the signed-in user for the Profile link; null until the profile UI (P1-14). */
  username: string | null;
  /** Account notices above the page content, e.g. the verify-email banner. */
  notice?: ReactNode;
  /**
   * Below 768px the page brings its own top and bottom bars (post detail, `1e`): no mobile header,
   * tab bar or "Ask dodoi" pill. Tablet and desktop keep the rail or sidebar.
   */
  fullScreenOnMobile?: boolean;
  children: ReactNode;
};

/**
 * Frame for signed-in pages (UI_UX_GUIDELINES §3):
 * mobile (< 768px) header + bottom tabs; tablet (768–1279px) icon rail; desktop (≥ 1280px) sidebar.
 */
export function AppShell({
  username,
  notice,
  fullScreenOnMobile = false,
  children,
}: AppShellProps) {
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-full bg-inverse px-4 py-2 text-control font-bold text-inverse-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      {fullScreenOnMobile ? null : <MobileHeader />}
      <IconRail username={username} className="hidden md:flex xl:hidden" />
      <Sidebar username={username} className="hidden xl:flex" />
      <main
        id="main-content"
        tabIndex={-1}
        className={cn("min-w-0 flex-1 outline-none md:pb-0", !fullScreenOnMobile && "pb-28")}
      >
        {notice}
        {children}
      </main>
      <AskDodoiPill
        className={cn(
          "right-4 bottom-25 md:right-6 md:bottom-6 xl:hidden",
          fullScreenOnMobile && "max-md:hidden",
        )}
      />
      {fullScreenOnMobile ? null : <BottomTabBar username={username} />}
    </div>
  );
}
