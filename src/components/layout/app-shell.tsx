import { Suspense, type ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

import { AskDodoiPill, AskDodoiPillView } from "./ask-dodoi";
import { BottomTabBar, BottomTabBarView } from "./bottom-tab-bar";
import { IconRail, IconRailView } from "./icon-rail";
import { MobileHeader } from "./mobile-header";
import { Sidebar, SidebarView } from "./sidebar";

// A page with the docked companion (`data-companion-dock`, P4-02) swaps the sidebar for the icon
// rail from 1280px (`2c`). The shell is static and doesn't know the page, so the swap is CSS.
const RAIL_CLASSES = "hidden md:flex xl:hidden group-has-[[data-companion-dock]]/shell:xl:flex";
const SIDEBAR_CLASSES = "hidden xl:flex group-has-[[data-companion-dock]]/shell:xl:hidden";

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
  const pillClasses = cn(
    "right-4 bottom-25 md:right-6 md:bottom-6 xl:hidden",
    fullScreenOnMobile && "max-md:hidden",
  );
  return (
    <div className="group/shell flex min-h-dvh flex-col md:flex-row">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-full bg-inverse px-4 py-2 text-control font-bold text-inverse-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      {fullScreenOnMobile ? null : <MobileHeader />}
      {/* Each nav highlights the current page; on dynamic routes that waits for the browser. */}
      <Suspense
        fallback={<IconRailView username={username} pathname="" className={RAIL_CLASSES} />}
      >
        <IconRail username={username} className={RAIL_CLASSES} />
      </Suspense>
      <Suspense
        fallback={<SidebarView username={username} pathname="" className={SIDEBAR_CLASSES} />}
      >
        <Sidebar username={username} className={SIDEBAR_CLASSES} />
      </Suspense>
      <main
        id="main-content"
        tabIndex={-1}
        className={cn("min-w-0 flex-1 outline-none md:pb-0", !fullScreenOnMobile && "pb-28")}
      >
        {notice}
        {children}
      </main>
      <Suspense fallback={<AskDodoiPillView className={pillClasses} />}>
        <AskDodoiPill className={pillClasses} />
      </Suspense>
      {fullScreenOnMobile ? null : (
        <Suspense fallback={<BottomTabBarView username={username} pathname="" />}>
          <BottomTabBar username={username} />
        </Suspense>
      )}
    </div>
  );
}
