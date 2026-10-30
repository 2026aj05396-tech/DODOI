"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils/cn";

import {
  COMMUNITY,
  CREATE,
  EXPLORE,
  HOME,
  isActivePath,
  profileNavItem,
  type NavItem,
} from "./nav-items";

function TabLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const Icon = item.icon;
  const isActive = isActivePath(pathname, item.href);
  return (
    <Link
      href={item.href ?? "/"}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex flex-col items-center gap-0.5 rounded-md py-1 text-tab",
        isActive ? "font-bold text-link" : "text-muted-foreground",
      )}
    >
      <Icon aria-hidden className="size-6" strokeWidth={isActive ? 2 : 1.7} />
      {item.label}
    </Link>
  );
}

/**
 * Mobile bottom navigation (`1c`): Home · Explore · Create · Community · Profile. Reads the current
 * path to highlight the active item. On pages whose address isn't known while prerendering (dynamic
 * routes), the app shell shows `BottomTabBarView` with nothing highlighted until the browser knows
 * it (Next.js Cache Components needs a Suspense boundary there).
 */
export function BottomTabBar({ username }: { username: string | null }) {
  return <BottomTabBarView username={username} pathname={usePathname()} />;
}

export function BottomTabBarView({
  username,
  pathname,
}: {
  username: string | null;
  pathname: string;
}) {
  const CreateIcon = CREATE.icon;

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-muted bg-background px-2 pt-2 pb-[max(1.375rem,env(safe-area-inset-bottom))] md:hidden"
    >
      <div className="grid grid-cols-5 items-start">
        <TabLink item={HOME} pathname={pathname} />
        <TabLink item={EXPLORE} pathname={pathname} />
        <div className="flex justify-center">
          <Link
            href={CREATE.href ?? "/create"}
            aria-label={CREATE.label}
            className="-mt-1 flex size-12 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-transform duration-150 hover:bg-primary-hover active:scale-95"
          >
            <CreateIcon aria-hidden className="size-6" strokeWidth={2.2} />
          </Link>
        </div>
        <TabLink item={COMMUNITY} pathname={pathname} />
        <TabLink item={profileNavItem(username)} pathname={pathname} />
      </div>
    </nav>
  );
}
